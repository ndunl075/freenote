import { describe, expect, it } from "vitest";
import type { Term } from "@/lib/db";
import {
  clearMismatch,
  createMatchGame,
  isMatchComplete,
  isPair,
  MATCH_PAIRS,
  MATCH_PENALTY_MS,
  matchElapsed,
  remainingTiles,
  selectTile,
  startMatch,
  type MatchState,
} from "./match";
import { createRng } from "./random";

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

const NOW = 5_000;
const tileFor = (s: MatchState, termId: string, side: "term" | "definition") =>
  s.tiles.find((t) => t.termId === termId && t.side === side)!;

describe("createMatchGame", () => {
  it("builds twelve shuffled tiles from six pairs", () => {
    const s = createMatchGame(makeTerms(20), createRng(1));
    expect(s.tiles).toHaveLength(MATCH_PAIRS * 2);
    const termIds = new Set(s.tiles.map((t) => t.termId));
    expect(termIds.size).toBe(MATCH_PAIRS);
    for (const id of termIds) {
      expect(s.tiles.filter((t) => t.termId === id).map((t) => t.side).sort()).toEqual(["definition", "term"]);
    }
    expect(s.startedAt).toBeNull();
    expect(s.matchedIds).toEqual([]);
  });

  it("uses every term when there are fewer than six and skips blanks", () => {
    const terms = [...makeTerms(3), { ...makeTerms(4)[3], term: "" }];
    const s = createMatchGame(terms, createRng(1));
    expect(s.tiles).toHaveLength(6);
    expect(s.tiles.map((t) => t.termId)).not.toContain("t3");
  });

  it("is reproducible with a seed", () => {
    expect(createMatchGame(makeTerms(10), createRng(3))).toEqual(createMatchGame(makeTerms(10), createRng(3)));
  });
});

describe("selecting tiles", () => {
  const base = createMatchGame(makeTerms(6), createRng(2));

  it("starts the clock on the first selection", () => {
    const s = selectTile(base, base.tiles[0].id, NOW);
    expect(s.startedAt).toBe(NOW);
    expect(s.selectedId).toBe(base.tiles[0].id);
    expect(startMatch(s, NOW + 10).startedAt).toBe(NOW);
  });

  it("deselects when the same tile is tapped twice", () => {
    let s = selectTile(base, base.tiles[0].id, NOW);
    s = selectTile(s, base.tiles[0].id, NOW);
    expect(s.selectedId).toBeNull();
    expect(s.attempts).toBe(0);
  });

  it("clears a correct pair", () => {
    let s = selectTile(base, tileFor(base, "t0", "term").id, NOW);
    s = selectTile(s, tileFor(base, "t0", "definition").id, NOW);
    expect(s.matchedIds.sort()).toEqual(["t0:definition", "t0:term"]);
    expect(s.selectedId).toBeNull();
    expect(s.mismatch).toBeNull();
    expect(s.attempts).toBe(1);
    expect(s.wrong).toBe(0);
    expect(remainingTiles(s)).toHaveLength(10);
  });

  it("flags and penalises a wrong pair", () => {
    let s = selectTile(base, tileFor(base, "t0", "term").id, NOW);
    s = selectTile(s, tileFor(base, "t1", "definition").id, NOW);
    expect(s.mismatch).toEqual(["t0:term", "t1:definition"]);
    expect(s.wrong).toBe(1);
    expect(s.penaltyMs).toBe(MATCH_PENALTY_MS);
    expect(s.selectedId).toBeNull();
    expect(clearMismatch(s).mismatch).toBeNull();
    expect(clearMismatch(clearMismatch(s))).toEqual(clearMismatch(s));
  });

  it("treats two terms of the same word as a mismatch", () => {
    const a = tileFor(base, "t0", "term");
    const b = tileFor(base, "t0", "definition");
    expect(isPair(a, b)).toBe(true);
    expect(isPair(a, a)).toBe(false);
    expect(isPair(a, tileFor(base, "t1", "term"))).toBe(false);
  });

  it("ignores matched tiles and unknown ids", () => {
    let s = selectTile(base, tileFor(base, "t0", "term").id, NOW);
    s = selectTile(s, tileFor(base, "t0", "definition").id, NOW);
    expect(selectTile(s, "t0:term", NOW)).toBe(s);
    expect(selectTile(s, "nope", NOW)).toBe(s);
  });

  it("finishes when every pair is cleared and freezes the clock", () => {
    let s = base;
    let t = NOW;
    for (let i = 0; i < 6; i++) {
      s = selectTile(s, `t${i}:term`, t);
      s = selectTile(s, `t${i}:definition`, (t += 500));
    }
    expect(isMatchComplete(s)).toBe(true);
    expect(s.finishedAt).toBe(t);
    expect(matchElapsed(s, t + 99_999)).toBe(t - NOW);
    expect(selectTile(s, "t0:term", t + 1)).toBe(s);
  });
});

describe("matchElapsed", () => {
  it("is zero before start and adds penalties while running", () => {
    const s = createMatchGame(makeTerms(6), createRng(4));
    expect(matchElapsed(s, NOW)).toBe(0);
    let running = selectTile(s, s.tiles[0].id, NOW);
    running = selectTile(running, s.tiles.find((t) => t.termId !== s.tiles[0].termId)!.id, NOW + 100);
    expect(matchElapsed(running, NOW + 1_500)).toBe(1_500 + MATCH_PENALTY_MS);
  });
});
