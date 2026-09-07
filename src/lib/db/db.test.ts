import { describe, expect, it } from "vitest";
import { notes, subjects } from "./notes";
import { progress, sets, terms } from "./sets";
import { settings } from "./settings";
import { exportAll, importAll, isFreenoteExport } from "@/lib/io/backup";

describe("notes repository", () => {
  it("creates a note with exactly one page", async () => {
    const note = await notes.create({ title: "Chem 101" });
    expect(note.pageIds).toHaveLength(1);
    const pages = await notes.pages(note.id);
    expect(pages).toHaveLength(1);
    expect(pages[0].index).toBe(0);
  });

  it("inserts a page in the middle and reindexes the rest", async () => {
    const note = await notes.create();
    await notes.addPage(note.id);
    await notes.addPage(note.id);
    const inserted = await notes.addPage(note.id, 0);

    const pages = await notes.pages(note.id);
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2, 3]);
    expect(pages[1].id).toBe(inserted.id);

    const reloaded = await notes.get(note.id);
    expect(reloaded?.pageIds).toEqual(pages.map((p) => p.id));
  });

  it("refuses to delete the last remaining page", async () => {
    const note = await notes.create();
    const [only] = await notes.pages(note.id);
    await notes.removePage(note.id, only.id);
    expect(await notes.pages(note.id)).toHaveLength(1);
  });

  it("unfiles notes instead of destroying them when a subject is deleted", async () => {
    const subject = await subjects.create("Biology", "#4255FF");
    const note = await notes.create({ subjectId: subject.id });

    await subjects.remove(subject.id);

    const survivor = await notes.get(note.id);
    expect(survivor).toBeDefined();
    expect(survivor?.subjectId).toBeNull();
  });

  it("copies every page when duplicating", async () => {
    const note = await notes.create({ title: "Original" });
    await notes.addPage(note.id);
    const copy = await notes.duplicate(note.id);

    expect(copy?.title).toBe("Original copy");
    expect(await notes.pages(copy!.id)).toHaveLength(2);
    // The copy must not share page records with the original.
    expect(copy?.pageIds).not.toEqual(note.pageIds);
  });
});

describe("sets and terms", () => {
  it("keeps term order stable through add and reorder", async () => {
    const set = await sets.create({ title: "Bones" });
    const added = await terms.addMany(set.id, [
      { term: "femur", definition: "thigh bone" },
      { term: "tibia", definition: "shin bone" },
      { term: "ulna", definition: "forearm bone" },
    ]);

    expect((await terms.forSet(set.id)).map((t) => t.term)).toEqual([
      "femur",
      "tibia",
      "ulna",
    ]);

    await terms.reorder(set.id, [added[2].id, added[0].id, added[1].id]);
    expect((await terms.forSet(set.id)).map((t) => t.term)).toEqual([
      "ulna",
      "femur",
      "tibia",
    ]);
  });

  it("closes the order gap when a term is removed", async () => {
    const set = await sets.create();
    const added = await terms.addMany(set.id, [
      { term: "a", definition: "1" },
      { term: "b", definition: "2" },
      { term: "c", definition: "3" },
    ]);
    await terms.remove(added[1].id);
    expect((await terms.forSet(set.id)).map((t) => t.order)).toEqual([0, 1]);
  });

  it("cascades term and progress deletion when a set is removed", async () => {
    const set = await sets.create();
    const [term] = await terms.addMany(set.id, [{ term: "x", definition: "y" }]);
    await progress.save([
      { ...(await progress.hydrate(set.id, [term.id])).get(term.id)!, box: 3 },
    ]);

    await sets.remove(set.id);

    expect(await terms.forSet(set.id)).toHaveLength(0);
    expect((await progress.forSet(set.id)).size).toBe(0);
  });

  it("fills missing progress records on hydrate", async () => {
    const set = await sets.create();
    const added = await terms.addMany(set.id, [
      { term: "a", definition: "1" },
      { term: "b", definition: "2" },
    ]);
    const map = await progress.hydrate(set.id, added.map((t) => t.id));
    expect(map.size).toBe(2);
    expect([...map.values()].every((p) => p.box === 0)).toBe(true);
  });

  it("summarises mastery", async () => {
    const set = await sets.create();
    const added = await terms.addMany(set.id, [
      { term: "a", definition: "1" },
      { term: "b", definition: "2" },
      { term: "c", definition: "3" },
    ]);
    const map = await progress.hydrate(set.id, added.map((t) => t.id));
    await progress.save([
      { ...map.get(added[0].id)!, box: 5 },
      { ...map.get(added[1].id)!, box: 2 },
    ]);

    expect(await progress.summary(set.id)).toEqual({
      total: 3,
      mastered: 1,
      learning: 1,
      notStarted: 1,
    });
  });
});

describe("settings", () => {
  it("fills in keys missing from a stored record", async () => {
    await settings.update({ stylusOnly: true });
    const loaded = await settings.get();
    expect(loaded.stylusOnly).toBe(true);
    expect(loaded.autoplaySeconds).toBe(4); // default survives a partial write
  });
});

describe("backup", () => {
  it("round-trips notes and sets through export/import", async () => {
    const subject = await subjects.create("History", "#FFCD1F");
    const note = await notes.create({ title: "WWI", subjectId: subject.id });
    const set = await sets.create({ title: "Treaties" });
    await terms.addMany(set.id, [{ term: "Versailles", definition: "1919" }]);

    const payload = await exportAll();
    expect(isFreenoteExport(payload)).toBe(true);

    await importAll(payload, "replace");

    expect((await notes.get(note.id))?.title).toBe("WWI");
    expect((await terms.forSet(set.id))[0].term).toBe("Versailles");
  });

  it("skips colliding records on merge rather than overwriting them", async () => {
    const note = await notes.create({ title: "Keep me" });
    const payload = await exportAll();
    await notes.rename(note.id, "Renamed locally");

    const result = await importAll(payload, "merge");

    expect(result.skipped).toBe(1);
    expect((await notes.get(note.id))?.title).toBe("Renamed locally");
  });

  it("rejects files that are not freenote exports", () => {
    expect(isFreenoteExport({ format: "something-else" })).toBe(false);
    expect(isFreenoteExport(null)).toBe(false);
  });
});
