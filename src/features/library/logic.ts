import type { ID, Note, StudySet, Subject } from "@/lib/db";

/* ============================================================================
   Library logic — pure functions over the records the db layer hands us.

   Nothing in here touches React or IndexedDB, which is what makes it cheap to
   test exhaustively. The store and components are thin wrappers around these.
   ========================================================================= */

/**
 * `StudySet` has no `starred` flag yet. The library keeps one as an optional
 * extra field on the record: Dexie stores unknown fields as-is and the backup
 * exporter round-trips them, so this becomes a no-op the day the schema grows
 * a real `starred: boolean`.
 */
/** Sets carry `starred` on the record itself; kept as an alias for clarity. */
export type LibrarySet = StudySet;

export type Section =
  | { kind: "all" }
  | { kind: "recents" }
  | { kind: "starred" }
  | { kind: "unfiled" }
  | { kind: "subject"; id: ID };

export type SortKey = "updated" | "title" | "created";
export type ViewMode = "grid" | "list";

interface ItemBase {
  id: ID;
  title: string;
  subjectId: ID | null;
  starred: boolean;
  updatedAt: number;
  createdAt: number;
}

export type LibraryItem =
  | (ItemBase & { kind: "note"; note: Note })
  | (ItemBase & { kind: "set"; set: LibrarySet; description: string });

/** How many items "Recents" shows. Notability caps its list similarly. */
export const RECENTS_LIMIT = 24;

export const SORT_LABELS: Record<SortKey, string> = {
  updated: "Recently edited",
  title: "Title",
  created: "Date created",
};

/* --- Items ---------------------------------------------------------------- */

export function toItems(notes: Note[], sets: LibrarySet[]): LibraryItem[] {
  const noteItems: LibraryItem[] = notes.map((note) => ({
    kind: "note",
    id: note.id,
    title: note.title,
    subjectId: note.subjectId,
    starred: note.starred,
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
    note,
  }));
  const setItems: LibraryItem[] = sets.map((set) => ({
    kind: "set",
    id: set.id,
    title: set.title,
    subjectId: set.subjectId,
    starred: set.starred === true,
    updatedAt: set.updatedAt,
    createdAt: set.createdAt,
    description: set.description,
    set,
  }));
  return [...noteItems, ...setItems];
}

/* --- Subjects ------------------------------------------------------------- */

export interface SubjectNode {
  subject: Subject;
  dividers: Subject[];
}

function bySiblingOrder(a: Subject, b: Subject): number {
  return a.order - b.order || a.createdAt - b.createdAt || a.name.localeCompare(b.name);
}

/**
 * Top-level subjects with their dividers nested one level deep. A divider
 * whose parent no longer exists is promoted to the top level rather than
 * hidden — an orphaned folder should still be reachable.
 */
export function subjectTree(subjects: Subject[]): SubjectNode[] {
  const ids = new Set(subjects.map((s) => s.id));
  const roots = subjects
    .filter((s) => s.parentId === null || !ids.has(s.parentId))
    .sort(bySiblingOrder);
  return roots.map((subject) => ({
    subject,
    dividers: subjects.filter((s) => s.parentId === subject.id).sort(bySiblingOrder),
  }));
}

/** The subject itself plus every divider filed under it. */
export function subjectScope(subjectId: ID, subjects: Subject[]): Set<ID> {
  const scope = new Set<ID>([subjectId]);
  for (const s of subjects) if (s.parentId === subjectId) scope.add(s.id);
  return scope;
}

/* --- Sections ------------------------------------------------------------- */

export function sectionKey(section: Section): string {
  return section.kind === "subject" ? `subject:${section.id}` : section.kind;
}

export function parseSectionKey(key: string): Section | null {
  if (key === "all" || key === "recents" || key === "starred" || key === "unfiled") {
    return { kind: key };
  }
  if (key.startsWith("subject:") && key.length > "subject:".length) {
    return { kind: "subject", id: key.slice("subject:".length) };
  }
  return null;
}

export function sameSection(a: Section, b: Section): boolean {
  return sectionKey(a) === sectionKey(b);
}

export function sectionTitle(section: Section, subjects: Subject[]): string {
  switch (section.kind) {
    case "all":
      return "All Notes";
    case "recents":
      return "Recents";
    case "starred":
      return "Starred";
    case "unfiled":
      return "Unfiled";
    case "subject":
      return subjects.find((s) => s.id === section.id)?.name ?? "Subject";
  }
}

/** The subject a new note should be filed under when created from a section. */
export function sectionSubjectId(section: Section): ID | null {
  return section.kind === "subject" ? section.id : null;
}

export function filterBySection(
  items: LibraryItem[],
  section: Section,
  subjects: Subject[],
): LibraryItem[] {
  switch (section.kind) {
    case "all":
      return items;
    case "recents":
      return [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENTS_LIMIT);
    case "starred":
      return items.filter((i) => i.starred);
    case "unfiled":
      return items.filter((i) => i.subjectId === null);
    case "subject": {
      const scope = subjectScope(section.id, subjects);
      return items.filter((i) => i.subjectId !== null && scope.has(i.subjectId));
    }
  }
}

/* --- Sorting -------------------------------------------------------------- */

const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortItems(items: LibraryItem[], sort: SortKey): LibraryItem[] {
  const out = [...items];
  switch (sort) {
    case "updated":
      out.sort((a, b) => b.updatedAt - a.updatedAt || titleCollator.compare(a.title, b.title));
      break;
    case "created":
      out.sort((a, b) => b.createdAt - a.createdAt || titleCollator.compare(a.title, b.title));
      break;
    case "title":
      out.sort((a, b) => titleCollator.compare(a.title, b.title) || b.updatedAt - a.updatedAt);
      break;
  }
  return out;
}

/* --- Search --------------------------------------------------------------- */

/** Case-, accent- and whitespace-insensitive form used for matching. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => (s ? s.split(" ") : []);

/**
 * Relevance score for a query against an item. 0 means no match. Higher tiers
 * always beat lower ones, so an exact title match outranks any substring hit.
 */
export function searchScore(item: LibraryItem, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(item.title);

  if (title === q) return 100;
  if (title.startsWith(q)) return 80;

  const titleWords = words(title);
  if (titleWords.some((w) => w.startsWith(q))) return 60;

  const queryWords = words(q);
  if (queryWords.length > 1 && queryWords.every((qw) => titleWords.some((w) => w.startsWith(qw)))) {
    return 50;
  }

  if (title.includes(q)) return 40;

  if (item.kind === "set" && normalize(item.description).includes(q)) return 20;

  return 0;
}

/** Items matching `query`, best first; ties fall back to most recently edited. */
export function rankSearch(items: LibraryItem[], query: string): LibraryItem[] {
  if (!normalize(query)) return items;
  return items
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
    .map((r) => r.item);
}

/* --- Counts --------------------------------------------------------------- */

export interface SectionCounts {
  all: number;
  recents: number;
  starred: number;
  unfiled: number;
  /** Subject id → items in that subject (including its dividers). */
  bySubject: Record<ID, number>;
}

export function countSections(items: LibraryItem[], subjects: Subject[]): SectionCounts {
  const bySubject: Record<ID, number> = {};
  for (const s of subjects) bySubject[s.id] = 0;

  const parentOf = new Map(subjects.map((s) => [s.id, s.parentId] as const));
  let starred = 0;
  let unfiled = 0;

  for (const item of items) {
    if (item.starred) starred++;
    if (item.subjectId === null) {
      unfiled++;
      continue;
    }
    if (item.subjectId in bySubject) {
      bySubject[item.subjectId]++;
      const parent = parentOf.get(item.subjectId);
      if (parent && parent in bySubject) bySubject[parent]++;
    }
  }

  return {
    all: items.length,
    recents: Math.min(items.length, RECENTS_LIMIT),
    starred,
    unfiled,
    bySubject,
  };
}

/* --- Reordering ----------------------------------------------------------- */

/** Move the element at `from` to `to`, clamping both into range. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (list.length === 0) return [];
  const clamp = (n: number) => Math.max(0, Math.min(list.length - 1, n));
  const f = clamp(from);
  const t = clamp(to);
  if (f === t) return [...list];
  const out = [...list];
  const [moved] = out.splice(f, 1);
  out.splice(t, 0, moved);
  return out;
}

/** Full pipeline: section → search → sort. */
export function visibleItems(
  items: LibraryItem[],
  opts: { section: Section; query: string; sort: SortKey; subjects: Subject[] },
): LibraryItem[] {
  const scoped = filterBySection(items, opts.section, opts.subjects);
  if (normalize(opts.query)) return rankSearch(scoped, opts.query);
  return sortItems(scoped, opts.sort);
}
