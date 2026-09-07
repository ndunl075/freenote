"use client";

import { create } from "zustand";
import { notes, progress, sets, subjects, type ID, type Note, type Subject } from "@/lib/db";
import {
  parseSectionKey,
  sectionKey,
  type LibraryItem,
  type LibrarySet,
  type Section,
  type SortKey,
  type ViewMode,
} from "./logic";

export interface Mastery {
  total: number;
  mastered: number;
  learning: number;
  notStarted: number;
}

export type LibraryDialog =
  | { kind: "rename"; item: LibraryItem }
  | { kind: "move"; item: LibraryItem }
  | { kind: "delete"; item: LibraryItem }
  | { kind: "delete-subject"; subject: Subject }
  | null;

interface Prefs {
  section: Section;
  sort: SortKey;
  view: ViewMode;
  expanded: Record<ID, boolean>;
}

interface LibraryStore extends Prefs {
  /** False until the first IndexedDB read lands; the grid shows a skeleton. */
  ready: boolean;
  subjects: Subject[];
  notes: Note[];
  sets: LibrarySet[];
  mastery: Record<ID, Mastery>;

  query: string;
  sidebarOpen: boolean;
  editingSubjectId: ID | null;
  dialog: LibraryDialog;

  load: () => Promise<void>;
  setSection: (section: Section) => void;
  setQuery: (query: string) => void;
  setSort: (sort: SortKey) => void;
  setView: (view: ViewMode) => void;
  setExpanded: (id: ID, expanded: boolean) => void;
  toggleExpanded: (id: ID) => void;
  setSidebarOpen: (open: boolean) => void;
  setEditingSubjectId: (id: ID | null) => void;
  setDialog: (dialog: LibraryDialog) => void;
  /** Optimistic reorder while dragging; `actions.persistSubjectOrder` commits. */
  setSubjects: (subjects: Subject[]) => void;
}

const PREFS_KEY = "freenote.library.prefs";

function readPrefs(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      section?: string;
      sort?: SortKey;
      view?: ViewMode;
      expanded?: Record<ID, boolean>;
    };
    const out: Partial<Prefs> = {};
    const section = parsed.section ? parseSectionKey(parsed.section) : null;
    if (section) out.section = section;
    if (parsed.sort === "updated" || parsed.sort === "title" || parsed.sort === "created") {
      out.sort = parsed.sort;
    }
    if (parsed.view === "grid" || parsed.view === "list") out.view = parsed.view;
    if (parsed.expanded && typeof parsed.expanded === "object") out.expanded = parsed.expanded;
    return out;
  } catch {
    return {};
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        section: sectionKey(p.section),
        sort: p.sort,
        view: p.view,
        expanded: p.expanded,
      }),
    );
  } catch {
    /* private mode — preferences just won't stick */
  }
}

export const useLibrary = create<LibraryStore>((set, get) => {
  const persist = () => {
    const { section, sort, view, expanded } = get();
    writePrefs({ section, sort, view, expanded });
  };

  return {
    ready: false,
    subjects: [],
    notes: [],
    sets: [],
    mastery: {},

    section: { kind: "all" },
    sort: "updated",
    view: "grid",
    expanded: {},

    query: "",
    sidebarOpen: false,
    editingSubjectId: null,
    dialog: null,

    async load() {
      // Preferences hydrate alongside the first data load so the server-
      // rendered shell and the first client render agree.
      const prefs = get().ready ? {} : readPrefs();

      const [subjectRows, noteRows, setRows] = await Promise.all([
        subjects.all(),
        notes.all(),
        sets.all(),
      ]);
      const summaries = await Promise.all(setRows.map((s) => progress.summary(s.id)));
      const mastery: Record<ID, Mastery> = {};
      setRows.forEach((s, i) => {
        mastery[s.id] = summaries[i];
      });

      // A remembered subject that has since been deleted falls back to All.
      const remembered = prefs.section ?? get().section;
      const subjectIds = new Set(subjectRows.map((s) => s.id));
      const section: Section =
        remembered.kind === "subject" && !subjectIds.has(remembered.id)
          ? { kind: "all" }
          : remembered;

      set({
        ready: true,
        subjects: subjectRows,
        notes: noteRows,
        sets: setRows,
        mastery,
        section,
        ...(prefs.sort ? { sort: prefs.sort } : {}),
        ...(prefs.view ? { view: prefs.view } : {}),
        ...(prefs.expanded ? { expanded: prefs.expanded } : {}),
      });
    },

    setSection(section) {
      set({ section, sidebarOpen: false });
      persist();
    },
    setQuery(query) {
      set({ query });
    },
    setSort(sort) {
      set({ sort });
      persist();
    },
    setView(view) {
      set({ view });
      persist();
    },
    setExpanded(id, expanded) {
      set((s) => ({ expanded: { ...s.expanded, [id]: expanded } }));
      persist();
    },
    toggleExpanded(id) {
      set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } }));
      persist();
    },
    setSidebarOpen(sidebarOpen) {
      set({ sidebarOpen });
    },
    setEditingSubjectId(editingSubjectId) {
      set({ editingSubjectId });
    },
    setDialog(dialog) {
      set({ dialog });
    },
    setSubjects(subjects) {
      set({ subjects });
    },
  };
});
