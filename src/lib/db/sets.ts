import { db } from "./database";
import { blobs } from "./blobs";
import { newId } from "@/lib/utils/id";
import type { ID, MatchRecord, Progress, StudyMode, StudySet, Term } from "./types";

export const emptyProgress = (termId: ID, setId: ID): Progress => ({
  termId,
  setId,
  box: 0,
  streak: 0,
  lapses: 0,
  seen: 0,
  correct: 0,
  dueAt: 0,
  lastSeenAt: 0,
  writtenCorrect: 0,
  choiceCorrect: 0,
});

export const sets = {
  all: () => db().sets.orderBy("updatedAt").reverse().toArray(),

  get: (id: ID) => db().sets.get(id),

  recent: (limit = 12) => db().sets.orderBy("updatedAt").reverse().limit(limit).toArray(),

  bySubject: (subjectId: ID | null) =>
    subjectId === null
      ? db().sets.filter((s) => s.subjectId === null).toArray()
      : db().sets.where("subjectId").equals(subjectId).toArray(),

  async create(input?: Partial<StudySet>): Promise<StudySet> {
    const now = Date.now();
    const set: StudySet = {
      id: newId("set"),
      title: input?.title ?? "Untitled set",
      description: input?.description ?? "",
      subjectId: input?.subjectId ?? null,
      sourceNoteId: input?.sourceNoteId ?? null,
      termLanguage: input?.termLanguage ?? "en",
      definitionLanguage: input?.definitionLanguage ?? "en",
      createdAt: now,
      updatedAt: now,
    };
    await db().sets.put(set);
    return set;
  },

  async update(id: ID, patch: Partial<StudySet>) {
    await db().sets.update(id, { ...patch, updatedAt: Date.now() });
  },

  async remove(id: ID) {
    await db().transaction(
      "rw",
      db().sets,
      db().terms,
      db().progress,
      db().matchRecords,
      db().sessions,
      async () => {
        await db().terms.where("setId").equals(id).delete();
        await db().progress.where("setId").equals(id).delete();
        await db().matchRecords.where("setId").equals(id).delete();
        await db().sessions.where("setId").equals(id).delete();
        await db().sets.delete(id);
      },
    );
    void blobs.collectGarbage();
  },

  async duplicate(id: ID): Promise<StudySet | null> {
    const source = await db().sets.get(id);
    if (!source) return null;
    const sourceTerms = await terms.forSet(id);
    const copy = await sets.create({ ...source, title: `${source.title} copy` });
    await db().terms.bulkPut(
      sourceTerms.map((t) => ({ ...t, id: newId("term"), setId: copy.id })),
    );
    return copy;
  },

  count: (id: ID) => db().terms.where("setId").equals(id).count(),

  async search(query: string): Promise<StudySet[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await db().sets.toArray();
    return all
      .filter((s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
};

export const terms = {
  async forSet(setId: ID): Promise<Term[]> {
    const list = await db().terms.where("setId").equals(setId).toArray();
    return list.sort((a, b) => a.order - b.order);
  },

  async add(setId: ID, term = "", definition = ""): Promise<Term> {
    const count = await db().terms.where("setId").equals(setId).count();
    const record: Term = {
      id: newId("term"),
      setId,
      term,
      definition,
      imageBlobId: null,
      order: count,
      starred: false,
    };
    await db().terms.put(record);
    await sets.update(setId, {});
    return record;
  },

  /** Bulk insert used by the paste-import flow and note-to-set generation. */
  async addMany(setId: ID, rows: { term: string; definition: string }[]): Promise<Term[]> {
    const start = await db().terms.where("setId").equals(setId).count();
    const records: Term[] = rows.map((r, i) => ({
      id: newId("term"),
      setId,
      term: r.term,
      definition: r.definition,
      imageBlobId: null,
      order: start + i,
      starred: false,
    }));
    await db().terms.bulkPut(records);
    await sets.update(setId, {});
    return records;
  },

  async update(id: ID, patch: Partial<Term>) {
    await db().terms.update(id, patch);
    const t = await db().terms.get(id);
    if (t) await sets.update(t.setId, {});
  },

  async toggleStar(id: ID) {
    const t = await db().terms.get(id);
    if (t) await db().terms.update(id, { starred: !t.starred });
  },

  async remove(id: ID) {
    const t = await db().terms.get(id);
    if (!t) return;
    await db().transaction("rw", db().terms, db().progress, async () => {
      await db().terms.delete(id);
      await db().progress.delete(id);
    });
    await terms.reindex(t.setId);
  },

  async reorder(setId: ID, orderedIds: ID[]) {
    await db().transaction("rw", db().terms, async () => {
      await Promise.all(orderedIds.map((id, i) => db().terms.update(id, { order: i })));
    });
    await sets.update(setId, {});
  },

  async reindex(setId: ID) {
    const list = await terms.forSet(setId);
    await db().transaction("rw", db().terms, async () => {
      await Promise.all(list.map((t, i) => db().terms.update(t.id, { order: i })));
    });
  },
};

export const progress = {
  async forSet(setId: ID): Promise<Map<ID, Progress>> {
    const rows = await db().progress.where("setId").equals(setId).toArray();
    return new Map(rows.map((p) => [p.termId, p]));
  },

  /** Returns existing progress, filling gaps with fresh records so callers
   *  never have to null-check a term they know exists. */
  async hydrate(setId: ID, termIds: ID[]): Promise<Map<ID, Progress>> {
    const existing = await progress.forSet(setId);
    for (const id of termIds) {
      if (!existing.has(id)) existing.set(id, emptyProgress(id, setId));
    }
    return existing;
  },

  async save(records: Progress[]) {
    if (records.length) await db().progress.bulkPut(records);
  },

  async resetSet(setId: ID) {
    await db().transaction("rw", db().progress, db().sessions, async () => {
      await db().progress.where("setId").equals(setId).delete();
      await db().sessions.where("setId").equals(setId).delete();
    });
  },

  /** Mastery summary shown on the set page and Learn round bars. */
  async summary(setId: ID) {
    const rows = await db().progress.where("setId").equals(setId).toArray();
    const total = await sets.count(setId);
    const mastered = rows.filter((p) => p.box >= 5).length;
    const learning = rows.filter((p) => p.box > 0 && p.box < 5).length;
    return { total, mastered, learning, notStarted: total - mastered - learning };
  },
};

export const matchRecords = {
  async best(setId: ID): Promise<MatchRecord | undefined> {
    const rows = await db().matchRecords.where("setId").equals(setId).toArray();
    return rows.sort((a, b) => a.timeMs - b.timeMs)[0];
  },

  async top(setId: ID, limit = 5): Promise<MatchRecord[]> {
    const rows = await db().matchRecords.where("setId").equals(setId).toArray();
    return rows.sort((a, b) => a.timeMs - b.timeMs).slice(0, limit);
  },

  async record(setId: ID, timeMs: number, termCount: number): Promise<MatchRecord> {
    const rec: MatchRecord = {
      id: newId("match"),
      setId,
      timeMs,
      termCount,
      achievedAt: Date.now(),
    };
    await db().matchRecords.put(rec);
    return rec;
  },
};

export const sessions = {
  async load(setId: ID, mode: StudyMode) {
    const rows = await db().sessions.where({ setId, mode }).toArray();
    return rows.find((s) => s.endedAt === null) ?? null;
  },

  async save(setId: ID, mode: StudyMode, state: unknown) {
    const open = await sessions.load(setId, mode);
    if (open) {
      await db().sessions.update(open.id, { state });
      return open.id;
    }
    const id = newId("sess");
    await db().sessions.put({
      id,
      setId,
      mode,
      startedAt: Date.now(),
      endedAt: null,
      state,
    });
    return id;
  },

  async end(setId: ID, mode: StudyMode) {
    const open = await sessions.load(setId, mode);
    if (open) await db().sessions.update(open.id, { endedAt: Date.now() });
  },
};
