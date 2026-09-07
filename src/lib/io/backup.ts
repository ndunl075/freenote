import { db } from "@/lib/db/database";
import type { FreenoteExport, ID } from "@/lib/db/types";

/* ============================================================================
   Backup / restore

   freenote has no cloud, so the export file *is* the backup story. It is plain
   readable JSON — someone should be able to open it in a text editor twenty
   years from now and still get their notes out.
   ========================================================================= */

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Chunked to avoid blowing the argument limit on large audio recordings.
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportAll(): Promise<FreenoteExport> {
  const d = db();
  const [subjects, notes, pages, recordings, sets, terms, progress, matchRecords, blobRows] =
    await Promise.all([
      d.subjects.toArray(),
      d.notes.toArray(),
      d.pages.toArray(),
      d.recordings.toArray(),
      d.sets.toArray(),
      d.terms.toArray(),
      d.progress.toArray(),
      d.matchRecords.toArray(),
      d.blobs.toArray(),
    ]);

  return {
    format: "freenote-export",
    version: 1,
    exportedAt: Date.now(),
    subjects,
    notes,
    pages,
    recordings,
    sets,
    terms,
    progress,
    matchRecords,
    blobs: await Promise.all(
      blobRows.map(async (b) => ({
        id: b.id,
        mime: b.mime,
        data: await blobToBase64(b.blob),
      })),
    ),
  };
}

export function isFreenoteExport(value: unknown): value is FreenoteExport {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as FreenoteExport).format === "freenote-export" &&
    (value as FreenoteExport).version === 1
  );
}

export type ImportMode = "merge" | "replace";

/**
 * Restore a backup. `merge` keeps what's already here and skips colliding ids;
 * `replace` wipes first. Merge is the default because silently destroying
 * existing notes is the worst thing this function could do.
 */
export async function importAll(
  data: FreenoteExport,
  mode: ImportMode = "merge",
): Promise<{ notes: number; sets: number; skipped: number }> {
  const d = db();
  let skipped = 0;

  await d.transaction(
    "rw",
    [d.subjects, d.notes, d.pages, d.recordings, d.blobs, d.sets, d.terms, d.progress, d.matchRecords],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          d.subjects.clear(),
          d.notes.clear(),
          d.pages.clear(),
          d.recordings.clear(),
          d.blobs.clear(),
          d.sets.clear(),
          d.terms.clear(),
          d.progress.clear(),
          d.matchRecords.clear(),
        ]);
      }

      const existingNotes = new Set<ID>(await d.notes.toCollection().primaryKeys());
      const existingSets = new Set<ID>(await d.sets.toCollection().primaryKeys());

      const incomingNotes = data.notes.filter((n) => {
        if (existingNotes.has(n.id)) {
          skipped++;
          return false;
        }
        return true;
      });
      const keptNoteIds = new Set(incomingNotes.map((n) => n.id));

      const incomingSets = data.sets.filter((s) => {
        if (existingSets.has(s.id)) {
          skipped++;
          return false;
        }
        return true;
      });
      const keptSetIds = new Set(incomingSets.map((s) => s.id));

      await d.subjects.bulkPut(data.subjects);
      await d.notes.bulkPut(incomingNotes);
      await d.pages.bulkPut(data.pages.filter((p) => keptNoteIds.has(p.noteId)));
      await d.recordings.bulkPut(data.recordings.filter((r) => keptNoteIds.has(r.noteId)));
      await d.sets.bulkPut(incomingSets);
      await d.terms.bulkPut(data.terms.filter((t) => keptSetIds.has(t.setId)));
      await d.progress.bulkPut(data.progress.filter((p) => keptSetIds.has(p.setId)));
      await d.matchRecords.bulkPut(data.matchRecords.filter((m) => keptSetIds.has(m.setId)));
      await d.blobs.bulkPut(
        data.blobs.map((b) => {
          const blob = base64ToBlob(b.data, b.mime);
          return { id: b.id, blob, mime: b.mime, size: blob.size, createdAt: Date.now() };
        }),
      );
    },
  );

  return { notes: data.notes.length - skipped, sets: data.sets.length, skipped };
}

/** Trigger a browser download of the full backup. */
export async function downloadBackup(): Promise<void> {
  const payload = await exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `freenote-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Erase everything. Used by Settings → Delete all data. */
export async function wipeAll(): Promise<void> {
  const d = db();
  await d.transaction(
    "rw",
    [d.subjects, d.notes, d.pages, d.recordings, d.blobs, d.sets, d.terms, d.progress, d.matchRecords, d.sessions, d.settings],
    async () => {
      await Promise.all([
        d.subjects.clear(),
        d.notes.clear(),
        d.pages.clear(),
        d.recordings.clear(),
        d.blobs.clear(),
        d.sets.clear(),
        d.terms.clear(),
        d.progress.clear(),
        d.matchRecords.clear(),
        d.sessions.clear(),
        d.settings.clear(),
      ]);
    },
  );
}
