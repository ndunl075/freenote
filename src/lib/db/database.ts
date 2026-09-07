import Dexie, { type EntityTable } from "dexie";
import type {
  MatchRecord,
  Note,
  Page,
  Progress,
  Recording,
  Settings,
  StoredBlob,
  StudySession,
  StudySet,
  Subject,
  Term,
} from "./types";

/**
 * The whole of freenote's storage. One IndexedDB database, no server mirror.
 *
 * Schema changes ship as a new `.version(n)` block with an upgrade function.
 * The rule is absolute: an upgrade may add, backfill, or reshape, but it must
 * never drop a field that held user content.
 */
export class FreenoteDB extends Dexie {
  subjects!: EntityTable<Subject, "id">;
  notes!: EntityTable<Note, "id">;
  pages!: EntityTable<Page, "id">;
  recordings!: EntityTable<Recording, "id">;
  blobs!: EntityTable<StoredBlob, "id">;
  sets!: EntityTable<StudySet, "id">;
  terms!: EntityTable<Term, "id">;
  progress!: EntityTable<Progress, "termId">;
  matchRecords!: EntityTable<MatchRecord, "id">;
  sessions!: EntityTable<StudySession, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor(name = "freenote") {
    super(name);

    this.version(1).stores({
      subjects: "id, parentId, order",
      notes: "id, subjectId, updatedAt, starred, title",
      pages: "id, noteId, [noteId+index]",
      recordings: "id, noteId",
      blobs: "id",
      sets: "id, subjectId, updatedAt, sourceNoteId, title, starred",
      terms: "id, setId, [setId+order], starred",
      progress: "termId, setId, dueAt, box",
      matchRecords: "id, setId, timeMs",
      sessions: "id, setId, [setId+mode]",
      settings: "id",
    });
  }
}

let instance: FreenoteDB | null = null;

/** Lazily constructed so importing db code never touches IndexedDB on the
 *  server during the static export build. */
export function db(): FreenoteDB {
  if (!instance) instance = new FreenoteDB();
  return instance;
}

/** Test seam: swap in a fake-indexeddb-backed instance. */
export function __setDb(next: FreenoteDB | null): void {
  instance = next;
}

/** How much space we're using, when the browser will tell us. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

/**
 * Ask the browser to make our storage persistent so it survives eviction
 * under disk pressure. Best-effort: browsers may grant, deny, or ignore it.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
