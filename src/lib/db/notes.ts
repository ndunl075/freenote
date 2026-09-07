import { db } from "./database";
import { blobs } from "./blobs";
import { newId } from "@/lib/utils/id";
import { DEFAULT_SETTINGS, type ID, type Note, type Page, type PaperColor, type PaperStyle, type Subject } from "./types";

/** Notability's default page is US Letter at 96dpi. */
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;

export const subjects = {
  all: () => db().subjects.orderBy("order").toArray(),

  async create(name: string, color: string, parentId: ID | null = null): Promise<Subject> {
    const order = (await db().subjects.count()) + 1;
    const subject: Subject = {
      id: newId("sub"),
      name,
      color,
      parentId,
      order,
      createdAt: Date.now(),
    };
    await db().subjects.put(subject);
    return subject;
  },

  async rename(id: ID, name: string) {
    await db().subjects.update(id, { name });
  },

  async recolor(id: ID, color: string) {
    await db().subjects.update(id, { color });
  },

  /** Persist a drag-reorder in one transaction. */
  async reorder(orderedIds: ID[]) {
    await db().transaction("rw", db().subjects, async () => {
      await Promise.all(
        orderedIds.map((id, i) => db().subjects.update(id, { order: i + 1 })),
      );
    });
  },

  /** Deleting a subject unfiles its notes rather than destroying them —
   *  losing a folder should never lose the work inside it. */
  async remove(id: ID) {
    await db().transaction("rw", db().subjects, db().notes, db().sets, async () => {
      await db().notes.where("subjectId").equals(id).modify({ subjectId: null });
      await db().sets.where("subjectId").equals(id).modify({ subjectId: null });
      await db().subjects.delete(id);
    });
  },
};

export const notes = {
  all: () => db().notes.orderBy("updatedAt").reverse().toArray(),

  get: (id: ID) => db().notes.get(id),

  bySubject: (subjectId: ID | null) =>
    subjectId === null
      ? db().notes.filter((n) => n.subjectId === null).toArray()
      : db().notes.where("subjectId").equals(subjectId).toArray(),

  recent: (limit = 12) => db().notes.orderBy("updatedAt").reverse().limit(limit).toArray(),

  async create(input?: Partial<Pick<Note, "title" | "subjectId" | "paper" | "paperColor">>) {
    const now = Date.now();
    const noteId = newId("note");
    const page: Page = {
      id: newId("page"),
      noteId,
      index: 0,
      height: PAGE_HEIGHT,
      strokes: [],
      objects: [],
    };
    const note: Note = {
      id: noteId,
      subjectId: input?.subjectId ?? null,
      title: input?.title ?? "Untitled note",
      pageIds: [page.id],
      paper: (input?.paper ?? DEFAULT_SETTINGS.defaultPaper) as PaperStyle,
      paperColor: (input?.paperColor ?? DEFAULT_SETTINGS.defaultPaperColor) as PaperColor,
      starred: false,
      createdAt: now,
      updatedAt: now,
    };
    await db().transaction("rw", db().notes, db().pages, async () => {
      await db().pages.put(page);
      await db().notes.put(note);
    });
    return note;
  },

  async update(id: ID, patch: Partial<Note>) {
    await db().notes.update(id, { ...patch, updatedAt: Date.now() });
  },

  async rename(id: ID, title: string) {
    await notes.update(id, { title: title.trim() || "Untitled note" });
  },

  async toggleStar(id: ID) {
    const note = await db().notes.get(id);
    if (note) await notes.update(id, { starred: !note.starred });
  },

  async duplicate(id: ID): Promise<Note | null> {
    const source = await db().notes.get(id);
    if (!source) return null;
    const pages = await notes.pages(id);
    const newNoteId = newId("note");
    const copies: Page[] = pages.map((p, i) => ({
      ...p,
      id: newId("page"),
      noteId: newNoteId,
      index: i,
    }));
    const copy: Note = {
      ...source,
      id: newNoteId,
      title: `${source.title} copy`,
      pageIds: copies.map((p) => p.id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db().transaction("rw", db().notes, db().pages, async () => {
      await db().pages.bulkPut(copies);
      await db().notes.put(copy);
    });
    return copy;
  },

  async remove(id: ID) {
    await db().transaction(
      "rw",
      db().notes,
      db().pages,
      db().recordings,
      async () => {
        await db().pages.where("noteId").equals(id).delete();
        await db().recordings.where("noteId").equals(id).delete();
        await db().notes.delete(id);
      },
    );
    void blobs.collectGarbage();
  },

  /** Pages in document order. */
  async pages(noteId: ID): Promise<Page[]> {
    const list = await db().pages.where("noteId").equals(noteId).toArray();
    return list.sort((a, b) => a.index - b.index);
  },

  async addPage(noteId: ID, afterIndex?: number): Promise<Page> {
    const existing = await notes.pages(noteId);
    const at = afterIndex === undefined ? existing.length : afterIndex + 1;
    const page: Page = {
      id: newId("page"),
      noteId,
      index: at,
      height: PAGE_HEIGHT,
      strokes: [],
      objects: [],
    };
    const reindexed = [
      ...existing.slice(0, at),
      page,
      ...existing.slice(at).map((p) => ({ ...p, index: p.index + 1 })),
    ];
    await db().transaction("rw", db().notes, db().pages, async () => {
      await db().pages.bulkPut(reindexed);
      await db().notes.update(noteId, {
        pageIds: reindexed.map((p) => p.id),
        updatedAt: Date.now(),
      });
    });
    return page;
  },

  async removePage(noteId: ID, pageId: ID) {
    const existing = await notes.pages(noteId);
    if (existing.length <= 1) return; // a note always has at least one page
    const remaining = existing
      .filter((p) => p.id !== pageId)
      .map((p, i) => ({ ...p, index: i }));
    await db().transaction("rw", db().notes, db().pages, async () => {
      await db().pages.delete(pageId);
      await db().pages.bulkPut(remaining);
      await db().notes.update(noteId, {
        pageIds: remaining.map((p) => p.id),
        updatedAt: Date.now(),
      });
    });
  },

  /** Hot path: called on every debounced flush while the user is drawing. */
  async savePage(page: Page) {
    await db().transaction("rw", db().notes, db().pages, async () => {
      await db().pages.put(page);
      await db().notes.update(page.noteId, { updatedAt: Date.now() });
    });
  },

  async saveThumbnail(noteId: ID, dataUrl: string) {
    await db().notes.update(noteId, { thumbnail: dataUrl });
  },

  async search(query: string): Promise<Note[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await db().notes.toArray();
    return all
      .filter((n) => n.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
};
