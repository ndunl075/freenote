"use client";

import { create } from "zustand";
import type { ID, Note, NoteObject, Page, PaperColor, PaperStyle, Stroke } from "@/lib/db";
import { notes as notesRepo, settings as settingsRepo } from "@/lib/db";
import {
  EMPTY_SELECTION,
  History,
  apply,
  clearPathCache,
  invalidatePath,
  moveSelection,
  type Command,
  type Selection,
  type ToolId,
} from "@/lib/ink";

/* ============================================================================
   Editor state

   Pages are held in memory and flushed to IndexedDB on a debounce. Undo is a
   per-page History plus a cross-page order stack, so Cmd+Z always undoes the
   last thing you actually did — even if that was three pages up.
   ========================================================================= */

const SAVE_DEBOUNCE_MS = 600;

interface EditorState {
  noteId: ID | null;
  note: Note | null;
  pages: Page[];
  loading: boolean;

  tool: ToolId;
  color: string;
  size: number;
  eraserSize: number;
  highlighterColor: string;
  highlighterSize: number;

  zoom: number;
  selection: Selection;
  selectionPageId: ID | null;
  stylusOnly: boolean;

  /** Bumped whenever a page mutates, so canvases know to repaint. */
  revision: number;

  canUndo: boolean;
  canRedo: boolean;

  load: (noteId: ID) => Promise<void>;
  close: () => void;

  setTool: (tool: ToolId) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setEraserSize: (size: number) => void;
  setZoom: (zoom: number) => void;
  setStylusOnly: (v: boolean) => void;

  commitStroke: (pageId: ID, stroke: Stroke) => void;
  eraseStrokes: (pageId: ID, strokeIds: Set<string>) => void;
  addObject: (pageId: ID, object: NoteObject) => void;
  updateObject: (pageId: ID, before: NoteObject, after: NoteObject) => void;
  removeObject: (pageId: ID, object: NoteObject) => void;

  setSelection: (pageId: ID | null, selection: Selection) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  deleteSelection: () => void;
  clearSelection: () => void;

  undo: () => void;
  redo: () => void;

  addPage: (afterIndex?: number) => Promise<void>;
  removePage: (pageId: ID) => Promise<void>;
  setPaper: (paper: PaperStyle, color: PaperColor) => Promise<void>;
  rename: (title: string) => Promise<void>;

  flush: () => Promise<void>;
}

/* --- Module-local scratch state ------------------------------------------- */
/* Kept out of the store so mutating it never triggers a React render. */

const histories = new Map<ID, History>();
let undoOrder: ID[] = [];
let redoOrder: ID[] = [];
const dirtyPages = new Set<ID>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditor = create<EditorState>((set, get) => {
  const historyFor = (pageId: ID): History => {
    let h = histories.get(pageId);
    if (!h) {
      h = new History();
      histories.set(pageId, h);
    }
    return h;
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().flush(), SAVE_DEBOUNCE_MS);
  };

  /** Applies a command, records it for undo, and marks the page dirty. */
  const run = (pageId: ID, command: Command, record = true) => {
    const pages = get().pages.map((p) => (p.id === pageId ? apply(p, command) : p));
    if (record) {
      historyFor(pageId).push(command);
      undoOrder.push(pageId);
      redoOrder = [];
    }
    dirtyPages.add(pageId);
    set({
      pages,
      revision: get().revision + 1,
      canUndo: undoOrder.length > 0,
      canRedo: redoOrder.length > 0,
    });
    scheduleSave();
  };

  return {
    noteId: null,
    note: null,
    pages: [],
    loading: true,

    tool: "pen",
    color: "#1a1a1a",
    size: 3,
    eraserSize: 16,
    highlighterColor: "#ffe14d",
    highlighterSize: 18,

    zoom: 1,
    selection: EMPTY_SELECTION,
    selectionPageId: null,
    stylusOnly: false,

    revision: 0,
    canUndo: false,
    canRedo: false,

    async load(noteId) {
      set({ loading: true, noteId });
      clearPathCache();
      histories.clear();
      undoOrder = [];
      redoOrder = [];
      dirtyPages.clear();

      const [note, pages, prefs] = await Promise.all([
        notesRepo.get(noteId),
        notesRepo.pages(noteId),
        settingsRepo.get(),
      ]);

      set({
        note: note ?? null,
        pages,
        loading: false,
        stylusOnly: prefs.stylusOnly,
        selection: EMPTY_SELECTION,
        selectionPageId: null,
        canUndo: false,
        canRedo: false,
        revision: get().revision + 1,
      });

      if (note) void settingsRepo.update({ lastOpenedNoteId: note.id });
    },

    close() {
      void get().flush();
      clearPathCache();
      histories.clear();
      undoOrder = [];
      redoOrder = [];
      set({ noteId: null, note: null, pages: [], selection: EMPTY_SELECTION });
    },

    setTool: (tool) => {
      // Leaving the lasso should drop whatever it was holding, otherwise the
      // selection chrome lingers over a tool that can't act on it.
      if (tool !== "lasso") set({ tool, selection: EMPTY_SELECTION, selectionPageId: null });
      else set({ tool });
    },
    setColor: (color) =>
      set(get().tool === "highlighter" ? { highlighterColor: color } : { color }),
    setSize: (size) =>
      set(get().tool === "highlighter" ? { highlighterSize: size } : { size }),
    setEraserSize: (eraserSize) => set({ eraserSize }),
    setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
    setStylusOnly: (stylusOnly) => {
      set({ stylusOnly });
      void settingsRepo.update({ stylusOnly });
    },

    commitStroke: (pageId, stroke) => run(pageId, { kind: "add-strokes", strokes: [stroke] }),

    eraseStrokes: (pageId, strokeIds) => {
      if (strokeIds.size === 0) return;
      const page = get().pages.find((p) => p.id === pageId);
      if (!page) return;
      const removed = page.strokes.filter((s) => strokeIds.has(s.id));
      if (removed.length === 0) return;
      removed.forEach((s) => invalidatePath(s.id));
      run(pageId, { kind: "remove-strokes", strokes: removed });
    },

    addObject: (pageId, object) => run(pageId, { kind: "add-object", object }),
    updateObject: (pageId, before, after) =>
      run(pageId, { kind: "update-object", before, after }),
    removeObject: (pageId, object) => run(pageId, { kind: "remove-object", object }),

    setSelection: (selectionPageId, selection) => set({ selection, selectionPageId }),

    nudgeSelection: (dx, dy) => {
      const { selection, selectionPageId, pages } = get();
      if (!selectionPageId) return;
      const page = pages.find((p) => p.id === selectionPageId);
      if (!page) return;

      selection.strokeIds.forEach(invalidatePath);
      run(selectionPageId, {
        kind: "move",
        strokeIds: [...selection.strokeIds],
        objectIds: [...selection.objectIds],
        dx,
        dy,
      });

      // Keep the selection chrome glued to what it is holding.
      const moved = moveSelection(page.strokes, page.objects, selection, dx, dy);
      void moved;
      set({
        selection: {
          ...selection,
          bounds: [
            selection.bounds[0] + dx,
            selection.bounds[1] + dy,
            selection.bounds[2] + dx,
            selection.bounds[3] + dy,
          ],
        },
      });
    },

    deleteSelection: () => {
      const { selection, selectionPageId, pages } = get();
      if (!selectionPageId) return;
      const page = pages.find((p) => p.id === selectionPageId);
      if (!page) return;

      const strokes = page.strokes.filter((s) => selection.strokeIds.has(s.id));
      strokes.forEach((s) => invalidatePath(s.id));
      if (strokes.length) run(selectionPageId, { kind: "remove-strokes", strokes });
      for (const obj of page.objects.filter((o) => selection.objectIds.has(o.id))) {
        run(selectionPageId, { kind: "remove-object", object: obj });
      }
      set({ selection: EMPTY_SELECTION, selectionPageId: null });
    },

    clearSelection: () => set({ selection: EMPTY_SELECTION, selectionPageId: null }),

    undo() {
      const pageId = undoOrder.pop();
      if (!pageId) return;
      const page = get().pages.find((p) => p.id === pageId);
      const history = histories.get(pageId);
      if (!page || !history) return;

      const next = history.undo(page);
      if (!next) return;
      redoOrder.push(pageId);
      clearPathCache();
      dirtyPages.add(pageId);
      set({
        pages: get().pages.map((p) => (p.id === pageId ? next : p)),
        revision: get().revision + 1,
        canUndo: undoOrder.length > 0,
        canRedo: true,
        selection: EMPTY_SELECTION,
        selectionPageId: null,
      });
      scheduleSave();
    },

    redo() {
      const pageId = redoOrder.pop();
      if (!pageId) return;
      const page = get().pages.find((p) => p.id === pageId);
      const history = histories.get(pageId);
      if (!page || !history) return;

      const next = history.redo(page);
      if (!next) return;
      undoOrder.push(pageId);
      clearPathCache();
      dirtyPages.add(pageId);
      set({
        pages: get().pages.map((p) => (p.id === pageId ? next : p)),
        revision: get().revision + 1,
        canUndo: true,
        canRedo: redoOrder.length > 0,
      });
      scheduleSave();
    },

    async addPage(afterIndex) {
      const { noteId } = get();
      if (!noteId) return;
      await get().flush();
      await notesRepo.addPage(noteId, afterIndex);
      set({ pages: await notesRepo.pages(noteId), revision: get().revision + 1 });
    },

    async removePage(pageId) {
      const { noteId } = get();
      if (!noteId) return;
      await notesRepo.removePage(noteId, pageId);
      histories.delete(pageId);
      undoOrder = undoOrder.filter((id) => id !== pageId);
      redoOrder = redoOrder.filter((id) => id !== pageId);
      set({
        pages: await notesRepo.pages(noteId),
        revision: get().revision + 1,
        canUndo: undoOrder.length > 0,
        canRedo: redoOrder.length > 0,
      });
    },

    async setPaper(paper, paperColor) {
      const { noteId, note } = get();
      if (!noteId || !note) return;
      await notesRepo.update(noteId, { paper, paperColor });
      set({ note: { ...note, paper, paperColor }, revision: get().revision + 1 });
    },

    async rename(title) {
      const { noteId, note } = get();
      if (!noteId || !note) return;
      await notesRepo.rename(noteId, title);
      set({ note: { ...note, title: title.trim() || "Untitled note" } });
    },

    async flush() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (dirtyPages.size === 0) return;
      const toSave = get().pages.filter((p) => dirtyPages.has(p.id));
      dirtyPages.clear();
      await Promise.all(toSave.map((p) => notesRepo.savePage(p)));
    },
  };
});
