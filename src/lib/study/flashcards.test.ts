import { describe, expect, it } from "vitest";
import type { Term } from "@/lib/db";
import {
  createFlashcards,
  currentCardId,
  deckPosition,
  flashcardsReducer as reduce,
  pileOf,
  type FlashcardsState,
} from "./flashcards";

const makeTerms = (n: number): Term[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    setId: "set",
    term: `term ${i}`,
    definition: `definition ${i}`,
    imageBlobId: null,
    order: i,
    starred: false,
  }));

const deck = (n = 4, opts: Parameters<typeof createFlashcards>[1] = {}) =>
  createFlashcards(makeTerms(n), { seed: 1, ...opts });

describe("createFlashcards", () => {
  it("deals the set in order, term side up", () => {
    const s = deck(3);
    expect(s.deck).toEqual(["t0", "t1", "t2"]);
    expect(s.front).toBe("term");
    expect(currentCardId(s)).toBe("t0");
    expect(deckPosition(s)).toEqual({ position: 1, total: 3 });
  });

  it("can start shuffled", () => {
    const s = deck(10, { shuffled: true });
    expect(s.deck).not.toEqual(s.all);
    expect(s.deck.slice().sort()).toEqual(s.all.slice().sort());
  });
});

describe("navigation", () => {
  it("moves forward and back, unflipping as it goes", () => {
    let s = deck(3);
    s = reduce(s, { type: "flip" });
    expect(s.flipped).toBe(true);
    s = reduce(s, { type: "next" });
    expect(s.index).toBe(1);
    expect(s.flipped).toBe(false);
    s = reduce(s, { type: "prev" });
    expect(s.index).toBe(0);
    expect(reduce(s, { type: "prev" })).toBe(s);
  });

  it("finishes after the last card and can step back onto it", () => {
    let s = deck(2);
    s = reduce(s, { type: "next" });
    s = reduce(s, { type: "next" });
    expect(s.finished).toBe(true);
    expect(currentCardId(s)).toBeNull();
    expect(deckPosition(s)).toEqual({ position: 2, total: 2 });
    expect(reduce(s, { type: "next" })).toBe(s);
    expect(reduce(s, { type: "flip" })).toBe(s);
    s = reduce(s, { type: "prev" });
    expect(s.finished).toBe(false);
    expect(s.index).toBe(1);
  });

  it("jumps with goto, clamped", () => {
    const s = deck(5);
    expect(reduce(s, { type: "goto", index: 3 }).index).toBe(3);
    expect(reduce(s, { type: "goto", index: 99 }).index).toBe(4);
    expect(reduce(s, { type: "goto", index: -4 }).index).toBe(0);
  });

  it("does nothing on an empty deck", () => {
    const s = deck(0);
    expect(reduce(s, { type: "next" })).toBe(s);
    expect(reduce(s, { type: "flip" })).toBe(s);
    expect(currentCardId(s)).toBeNull();
  });
});

describe("options", () => {
  it("switches the front side and unflips", () => {
    let s = reduce(deck(2), { type: "flip" });
    s = reduce(s, { type: "set-front", front: "definition" });
    expect(s.front).toBe("definition");
    expect(s.flipped).toBe(false);
    expect(reduce(s, { type: "set-front", front: "definition" })).toBe(s);
  });

  it("shuffle reorders the deck and restarts; toggling back restores set order", () => {
    let s = deck(10);
    s = reduce(s, { type: "next" });
    s = reduce(s, { type: "toggle-shuffle" });
    expect(s.shuffled).toBe(true);
    expect(s.index).toBe(0);
    expect(s.deck).not.toEqual(s.all);
    s = reduce(s, { type: "toggle-shuffle" });
    expect(s.deck).toEqual(s.all);
  });
});

describe("sorting", () => {
  const sorting = (n = 3): FlashcardsState => deck(n, { sorting: true });

  it("ignores sort actions when tracking is off", () => {
    const s = deck(3);
    expect(reduce(s, { type: "sort", pile: "know" })).toBe(s);
  });

  it("files each card and advances, ending on a summary", () => {
    let s = sorting(3);
    s = reduce(s, { type: "sort", pile: "know" });
    expect(s.know).toEqual(["t0"]);
    expect(s.index).toBe(1);
    s = reduce(s, { type: "sort", pile: "learning" });
    s = reduce(s, { type: "sort", pile: "know" });
    expect(s.finished).toBe(true);
    expect(s.know).toEqual(["t0", "t2"]);
    expect(s.learning).toEqual(["t1"]);
    expect(pileOf(s, "t1")).toBe("learning");
    expect(pileOf(s, "t0")).toBe("know");
  });

  it("back undoes the previous sort", () => {
    let s = sorting(3);
    s = reduce(s, { type: "sort", pile: "know" });
    s = reduce(s, { type: "prev" });
    expect(s.index).toBe(0);
    expect(s.know).toEqual([]);
    expect(pileOf(s, "t0")).toBeNull();
  });

  it("re-sorting a card moves it between piles", () => {
    let s = sorting(2);
    s = reduce(s, { type: "sort", pile: "learning" });
    s = reduce(s, { type: "goto", index: 0 });
    s = reduce(s, { type: "sort", pile: "know" });
    expect(s.learning).toEqual([]);
    expect(s.know).toEqual(["t0"]);
  });

  it("turning tracking off clears the piles", () => {
    let s = sorting(2);
    s = reduce(s, { type: "sort", pile: "know" });
    s = reduce(s, { type: "toggle-sorting" });
    expect(s.sorting).toBe(false);
    expect(s.know).toEqual([]);
  });

  it("reviews only the still-learning pile, then restart returns to the full set", () => {
    let s = sorting(4);
    s = reduce(s, { type: "sort", pile: "know" });
    s = reduce(s, { type: "sort", pile: "learning" });
    s = reduce(s, { type: "sort", pile: "learning" });
    s = reduce(s, { type: "sort", pile: "know" });
    expect(s.finished).toBe(true);

    const review = reduce(s, { type: "review-learning" });
    expect(review.reviewing).toBe(true);
    expect(review.deck).toEqual(["t1", "t2"]);
    expect(review.finished).toBe(false);
    expect(review.know).toEqual([]);
    expect(deckPosition(review)).toEqual({ position: 1, total: 2 });

    const restarted = reduce(review, { type: "restart" });
    expect(restarted.deck).toEqual(["t0", "t1", "t2", "t3"]);
    expect(restarted.reviewing).toBe(false);
    expect(restarted.index).toBe(0);
  });

  it("cannot review an empty learning pile", () => {
    let s = sorting(1);
    s = reduce(s, { type: "sort", pile: "know" });
    expect(reduce(s, { type: "review-learning" })).toBe(s);
  });
});
