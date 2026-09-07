import { describe, expect, it } from "vitest";
import type { Note, Subject } from "@/lib/db";
import {
  countSections,
  filterBySection,
  moveItem,
  normalize,
  parseSectionKey,
  rankSearch,
  RECENTS_LIMIT,
  searchScore,
  sectionKey,
  sectionTitle,
  sortItems,
  subjectScope,
  subjectTree,
  toItems,
  visibleItems,
  type LibraryItem,
  type LibrarySet,
} from "./logic";

/* --- Fixtures ------------------------------------------------------------- */

const T0 = 1_700_000_000_000;

function subject(partial: Partial<Subject> & { id: string }): Subject {
  return {
    name: partial.id,
    color: "#4255ff",
    parentId: null,
    order: 0,
    createdAt: T0,
    ...partial,
  };
}

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    title: partial.id,
    subjectId: null,
    pageIds: [],
    paper: "lined-wide",
    paperColor: "white",
    starred: false,
    createdAt: T0,
    updatedAt: T0,
    ...partial,
  };
}

function set(partial: Partial<LibrarySet> & { id: string }): LibrarySet {
  return {
    title: partial.id,
    description: "",
    subjectId: null,
    sourceNoteId: null,
    termLanguage: "en",
    definitionLanguage: "en",
    createdAt: T0,
    updatedAt: T0,
    ...partial,
  };
}

const bio = subject({ id: "bio", name: "Biology", order: 2 });
const chem = subject({ id: "chem", name: "Chemistry", order: 1 });
const cells = subject({ id: "cells", name: "Cells", parentId: "bio", order: 2 });
const genetics = subject({ id: "genetics", name: "Genetics", parentId: "bio", order: 1 });
const orphan = subject({ id: "orphan", name: "Orphan", parentId: "gone", order: 9 });
const subjects = [bio, chem, cells, genetics, orphan];

const items = toItems(
  [
    note({ id: "n1", title: "Mitosis", subjectId: "cells", updatedAt: T0 + 5 }),
    note({ id: "n2", title: "Bonding", subjectId: "chem", starred: true, updatedAt: T0 + 4 }),
    note({ id: "n3", title: "Loose thoughts", updatedAt: T0 + 3 }),
    note({ id: "n4", title: "Photosynthesis", subjectId: "bio", updatedAt: T0 + 2 }),
  ],
  [
    set({ id: "s1", title: "Cell vocab", subjectId: "cells", starred: true, updatedAt: T0 + 6 }),
    set({ id: "s2", title: "Unfiled set", updatedAt: T0 + 1 }),
  ],
);

const ids = (list: LibraryItem[]) => list.map((i) => i.id);

/* --- toItems -------------------------------------------------------------- */

describe("toItems", () => {
  it("normalises notes and sets into one list", () => {
    expect(items).toHaveLength(6);
    expect(items.filter((i) => i.kind === "note")).toHaveLength(4);
    expect(items.filter((i) => i.kind === "set")).toHaveLength(2);
  });

  it("treats a missing set.starred as not starred", () => {
    const [plain] = toItems([], [set({ id: "x" })]);
    expect(plain.starred).toBe(false);
    const [starred] = toItems([], [set({ id: "y", starred: true })]);
    expect(starred.starred).toBe(true);
  });
});

/* --- subjectTree ---------------------------------------------------------- */

describe("subjectTree", () => {
  it("nests dividers under their parent, sorted by order", () => {
    const tree = subjectTree(subjects);
    const bioNode = tree.find((n) => n.subject.id === "bio")!;
    expect(bioNode.dividers.map((d) => d.id)).toEqual(["genetics", "cells"]);
  });

  it("orders top-level subjects by order", () => {
    expect(subjectTree(subjects).map((n) => n.subject.id)).toEqual(["chem", "bio", "orphan"]);
  });

  it("promotes a divider whose parent is gone to the top level", () => {
    const tree = subjectTree(subjects);
    expect(tree.some((n) => n.subject.id === "orphan")).toBe(true);
  });

  it("breaks order ties by creation time then name", () => {
    const a = subject({ id: "a", name: "Zed", order: 1, createdAt: T0 + 1 });
    const b = subject({ id: "b", name: "Alpha", order: 1, createdAt: T0 + 1 });
    const c = subject({ id: "c", name: "Mid", order: 1, createdAt: T0 });
    expect(subjectTree([a, b, c]).map((n) => n.subject.id)).toEqual(["c", "b", "a"]);
  });

  it("scopes a subject to itself plus its dividers", () => {
    expect([...subjectScope("bio", subjects)].sort()).toEqual(["bio", "cells", "genetics"]);
    expect([...subjectScope("cells", subjects)]).toEqual(["cells"]);
  });
});

/* --- sections ------------------------------------------------------------- */

describe("sections", () => {
  it("round-trips section keys", () => {
    const all = [
      { kind: "all" },
      { kind: "recents" },
      { kind: "starred" },
      { kind: "unfiled" },
      { kind: "subject", id: "bio" },
    ] as const;
    for (const s of all) expect(parseSectionKey(sectionKey(s))).toEqual(s);
    expect(parseSectionKey("nope")).toBeNull();
    expect(parseSectionKey("subject:")).toBeNull();
  });

  it("titles sections, falling back when a subject is missing", () => {
    expect(sectionTitle({ kind: "all" }, subjects)).toBe("All Notes");
    expect(sectionTitle({ kind: "subject", id: "bio" }, subjects)).toBe("Biology");
    expect(sectionTitle({ kind: "subject", id: "zzz" }, subjects)).toBe("Subject");
  });

  it("filters 'all' to everything", () => {
    expect(filterBySection(items, { kind: "all" }, subjects)).toHaveLength(6);
  });

  it("filters 'starred' to starred notes and sets", () => {
    expect(ids(filterBySection(items, { kind: "starred" }, subjects)).sort()).toEqual(["n2", "s1"]);
  });

  it("filters 'unfiled' to items with no subject", () => {
    expect(ids(filterBySection(items, { kind: "unfiled" }, subjects)).sort()).toEqual(["n3", "s2"]);
  });

  it("includes divider contents when a parent subject is selected", () => {
    const inBio = ids(filterBySection(items, { kind: "subject", id: "bio" }, subjects)).sort();
    expect(inBio).toEqual(["n1", "n4", "s1"]);
  });

  it("shows only the divider's own items when a divider is selected", () => {
    const inCells = ids(filterBySection(items, { kind: "subject", id: "cells" }, subjects)).sort();
    expect(inCells).toEqual(["n1", "s1"]);
  });

  it("caps recents and orders them newest first", () => {
    const many = toItems(
      Array.from({ length: RECENTS_LIMIT + 10 }, (_, i) =>
        note({ id: `n${i}`, updatedAt: T0 + i }),
      ),
      [],
    );
    const recents = filterBySection(many, { kind: "recents" }, []);
    expect(recents).toHaveLength(RECENTS_LIMIT);
    expect(recents[0].id).toBe(`n${RECENTS_LIMIT + 9}`);
    expect(recents.at(-1)?.id).toBe("n10");
  });
});

/* --- sorting -------------------------------------------------------------- */

describe("sortItems", () => {
  it("sorts by most recently edited", () => {
    expect(ids(sortItems(items, "updated"))).toEqual(["s1", "n1", "n2", "n3", "n4", "s2"]);
  });

  it("sorts by title, case-insensitively and with natural numbers", () => {
    const list = toItems(
      [
        note({ id: "a", title: "note 10" }),
        note({ id: "b", title: "Note 2" }),
        note({ id: "c", title: "apple" }),
        note({ id: "d", title: "Banana" }),
      ],
      [],
    );
    expect(ids(sortItems(list, "title"))).toEqual(["c", "d", "b", "a"]);
  });

  it("sorts by date created, newest first", () => {
    const list = toItems(
      [
        note({ id: "old", createdAt: T0, updatedAt: T0 + 100 }),
        note({ id: "new", createdAt: T0 + 1, updatedAt: T0 }),
      ],
      [],
    );
    expect(ids(sortItems(list, "created"))).toEqual(["new", "old"]);
  });

  it("does not mutate its input", () => {
    const copy = [...items];
    sortItems(items, "title");
    expect(items).toEqual(copy);
  });
});

/* --- search --------------------------------------------------------------- */

describe("normalize", () => {
  it("folds case, accents and whitespace", () => {
    expect(normalize("  Café   Crème ")).toBe("cafe creme");
    expect(normalize("ÉLAN")).toBe("elan");
  });
});

describe("search ranking", () => {
  const corpus = toItems(
    [
      note({ id: "exact", title: "Cell", updatedAt: T0 }),
      note({ id: "prefix", title: "Cell biology", updatedAt: T0 + 1 }),
      note({ id: "wordprefix", title: "Plant cells", updatedAt: T0 + 2 }),
      note({ id: "substring", title: "Excellent notes", updatedAt: T0 + 3 }),
      note({ id: "miss", title: "Algebra", updatedAt: T0 + 9 }),
    ],
    [
      set({ id: "desc", title: "Vocab", description: "cell parts", updatedAt: T0 + 4 }),
      set({ id: "multi", title: "Organic chem reactions", updatedAt: T0 + 5 }),
    ],
  );

  it("ranks exact > prefix > word-prefix > substring > description", () => {
    expect(ids(rankSearch(corpus, "cell"))).toEqual([
      "exact",
      "prefix",
      "wordprefix",
      "substring",
      "desc",
    ]);
  });

  it("excludes non-matches", () => {
    expect(ids(rankSearch(corpus, "cell"))).not.toContain("miss");
    expect(rankSearch(corpus, "zzzz")).toEqual([]);
  });

  it("returns the list untouched for an empty or whitespace query", () => {
    expect(rankSearch(corpus, "")).toBe(corpus);
    expect(rankSearch(corpus, "   ")).toBe(corpus);
  });

  it("matches multi-word queries against word prefixes in any order", () => {
    expect(ids(rankSearch(corpus, "react org"))).toEqual(["multi"]);
    expect(searchScore(corpus.find((i) => i.id === "multi")!, "react org")).toBe(50);
  });

  it("is case- and accent-insensitive", () => {
    expect(ids(rankSearch(corpus, "CÉLL"))[0]).toBe("exact");
  });

  it("breaks score ties by most recently edited", () => {
    const tie = toItems(
      [
        note({ id: "older", title: "Cells A", updatedAt: T0 }),
        note({ id: "newer", title: "Cells B", updatedAt: T0 + 1 }),
      ],
      [],
    );
    expect(ids(rankSearch(tie, "cells"))).toEqual(["newer", "older"]);
  });

  it("scores 0 for an empty query", () => {
    expect(searchScore(corpus[0], "")).toBe(0);
  });
});

/* --- counts --------------------------------------------------------------- */

describe("countSections", () => {
  it("counts every section, rolling dividers up into their parent", () => {
    const counts = countSections(items, subjects);
    expect(counts.all).toBe(6);
    expect(counts.starred).toBe(2);
    expect(counts.unfiled).toBe(2);
    expect(counts.bySubject.cells).toBe(2);
    expect(counts.bySubject.bio).toBe(3);
    expect(counts.bySubject.chem).toBe(1);
    expect(counts.bySubject.genetics).toBe(0);
  });

  it("caps the recents count at the limit", () => {
    expect(countSections(items, subjects).recents).toBe(6);
    const many = toItems(
      Array.from({ length: 50 }, (_, i) => note({ id: `n${i}` })),
      [],
    );
    expect(countSections(many, []).recents).toBe(RECENTS_LIMIT);
  });

  it("ignores items pointing at a subject that no longer exists", () => {
    const stray = toItems([note({ id: "x", subjectId: "ghost" })], []);
    const counts = countSections(stray, subjects);
    expect(counts.all).toBe(1);
    expect(counts.unfiled).toBe(0);
    expect(Object.values(counts.bySubject).every((n) => n === 0)).toBe(true);
  });
});

/* --- reorder -------------------------------------------------------------- */

describe("moveItem", () => {
  it("moves forward and backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("clamps out-of-range indices", () => {
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], -5, 1)).toEqual(["b", "a", "c"]);
  });

  it("is a no-op for same index or empty lists", () => {
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});

/* --- pipeline ------------------------------------------------------------- */

describe("visibleItems", () => {
  it("applies section, then sort", () => {
    const out = visibleItems(items, {
      section: { kind: "subject", id: "bio" },
      query: "",
      sort: "title",
      subjects,
    });
    expect(ids(out)).toEqual(["s1", "n1", "n4"]);
  });

  it("uses search ranking instead of the sort key when a query is present", () => {
    const out = visibleItems(items, {
      section: { kind: "all" },
      query: "cell",
      sort: "title",
      subjects,
    });
    expect(ids(out)).toEqual(["s1"]);
  });
});
