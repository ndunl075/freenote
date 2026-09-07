"use client";

import { toast } from "@/components/ui";
import {
  notes,
  sets,
  settings,
  subjects,
  type ID,
  type Note,
  type StudySet,
  type Subject,
} from "@/lib/db";
import { nextSubjectColor } from "./colors";
import { moveItem, subjectTree, type LibraryItem } from "./logic";
import { useLibrary } from "./store";

/* ============================================================================
   Library actions. Every mutation goes through the db repositories, then
   reloads the store — simpler and safer than patching local copies by hand.
   ========================================================================= */

const reload = () => useLibrary.getState().load();

/* --- Notes & sets --------------------------------------------------------- */

export async function createNote(subjectId: ID | null): Promise<Note> {
  const prefs = await settings.get();
  const note = await notes.create({
    subjectId,
    paper: prefs.defaultPaper,
    paperColor: prefs.defaultPaperColor,
  });
  await reload();
  return note;
}

export async function createSet(subjectId: ID | null): Promise<StudySet> {
  const set = await sets.create({ subjectId });
  await reload();
  return set;
}

export async function renameItem(item: LibraryItem, title: string): Promise<void> {
  const clean = title.trim();
  if (item.kind === "note") await notes.rename(item.id, clean);
  else await sets.update(item.id, { title: clean || "Untitled set" });
  await reload();
}

export async function duplicateItem(item: LibraryItem): Promise<void> {
  const copy = item.kind === "note" ? await notes.duplicate(item.id) : await sets.duplicate(item.id);
  await reload();
  if (copy) toast.success(`Duplicated “${item.title}”`);
}

export async function toggleStar(item: LibraryItem): Promise<void> {
  if (item.kind === "note") {
    await notes.toggleStar(item.id);
  } else {
    // `starred` is not part of StudySet yet — see LibrarySet in logic.ts.
    // Dexie persists the extra field and the backup exporter round-trips it.
    const patch = { starred: !item.starred } as unknown as Partial<StudySet>;
    await sets.update(item.id, patch);
  }
  await reload();
}

export async function moveItemToSubject(item: LibraryItem, subjectId: ID | null): Promise<void> {
  if (item.subjectId === subjectId) return;
  if (item.kind === "note") await notes.update(item.id, { subjectId });
  else await sets.update(item.id, { subjectId });
  await reload();
  const target = subjectId
    ? (useLibrary.getState().subjects.find((s) => s.id === subjectId)?.name ?? "subject")
    : "Unfiled";
  toast.success(`Moved “${item.title}” to ${target}`);
}

export async function deleteItem(item: LibraryItem): Promise<void> {
  if (item.kind === "note") await notes.remove(item.id);
  else await sets.remove(item.id);
  await reload();
  toast.show(`Deleted “${item.title}”`);
}

/* --- Subjects & dividers -------------------------------------------------- */

export async function createSubject(parentId: ID | null = null): Promise<Subject> {
  const { subjects: all } = useLibrary.getState();
  const parent = parentId ? all.find((s) => s.id === parentId) : undefined;
  const color = parent?.color ?? nextSubjectColor(all.map((s) => s.color));
  const subject = await subjects.create(parentId ? "New divider" : "New subject", color, parentId);
  await reload();
  const store = useLibrary.getState();
  if (parentId) store.setExpanded(parentId, true);
  store.setEditingSubjectId(subject.id);
  return subject;
}

export async function renameSubject(id: ID, name: string): Promise<void> {
  const current = useLibrary.getState().subjects.find((s) => s.id === id);
  if (!current) return;
  const clean = name.trim() || (current.parentId ? "New divider" : "New subject");
  if (clean !== current.name) await subjects.rename(id, clean);
  await reload();
}

export async function recolorSubject(id: ID, color: string): Promise<void> {
  await subjects.recolor(id, color);
  await reload();
}

/** Commit the order the sidebar currently shows for top-level subjects. */
export async function persistSubjectOrder(): Promise<void> {
  const roots = subjectTree(useLibrary.getState().subjects).map((n) => n.subject.id);
  await subjects.reorder(roots);
  await reload();
}

/** Keyboard reorder: shift a subject one slot among its siblings. */
export async function nudgeSubject(id: ID, dir: -1 | 1): Promise<boolean> {
  const all = useLibrary.getState().subjects;
  const me = all.find((s) => s.id === id);
  if (!me) return false;

  const tree = subjectTree(all);
  const parentExists = me.parentId !== null && all.some((s) => s.id === me.parentId);
  const siblings = parentExists
    ? (tree.find((n) => n.subject.id === me.parentId)?.dividers ?? [])
    : tree.map((n) => n.subject);

  const from = siblings.findIndex((s) => s.id === id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= siblings.length) return false;

  await subjects.reorder(moveItem(siblings, from, to).map((s) => s.id));
  await reload();
  return true;
}

/**
 * Deleting a subject unfiles its contents rather than destroying them (that
 * is the repository's contract). Dividers go first so nothing is orphaned.
 */
export async function deleteSubject(subject: Subject): Promise<void> {
  const state = useLibrary.getState();
  const dividers = state.subjects.filter((s) => s.parentId === subject.id);
  for (const d of dividers) await subjects.remove(d.id);
  await subjects.remove(subject.id);

  const gone = new Set([subject.id, ...dividers.map((d) => d.id)]);
  const { section } = useLibrary.getState();
  if (section.kind === "subject" && gone.has(section.id)) {
    useLibrary.getState().setSection({ kind: "all" });
  }
  await reload();
  toast.show(`Deleted ${subject.name} — its notes are now in Unfiled`);
}
