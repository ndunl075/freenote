import { describe, expect, it } from "vitest";
import type { Term } from "@/lib/db";
import {
  answerBlast,
  BLAST_LIVES,
  createBlastState,
  HITS_PER_LEVEL,
  isBlastOver,
  levelForHits,
  maxConcurrentForLevel,
  pointsFor,
  POP_TTL_MS,
  spawnIntervalForLevel,
  speedForLevel,
  startBlast,
  tickBlast,
  type BlastState,
} from "./blast";

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

const T0 = 10_000;

function running(n = 10, seed = 1): BlastState {
  return startBlast(createBlastState(makeTerms(n), { seed }), T0);
}

describe("difficulty curves", () => {
  it("gets faster, spawns quicker and stacks more tiles as levels rise", () => {
    expect(speedForLevel(2)).toBeGreaterThan(speedForLevel(1));
    expect(spawnIntervalForLevel(3)).toBeLessThan(spawnIntervalForLevel(1));
    expect(spawnIntervalForLevel(50)).toBeGreaterThanOrEqual(1_300);
    expect(maxConcurrentForLevel(1)).toBe(2);
    expect(maxConcurrentForLevel(6)).toBe(5);
    expect(maxConcurrentForLevel(40)).toBe(5);
    expect(levelForHits(0)).toBe(1);
    expect(levelForHits(HITS_PER_LEVEL)).toBe(2);
    expect(levelForHits(1000)).toBeLessThanOrEqual(10);
    expect(pointsFor(2, 3)).toBe(230);
    expect(pointsFor(1, 50)).toBe(200);
  });
});

describe("startBlast", () => {
  it("spawns one tile at the top and sets the clock", () => {
    const s = running();
    expect(s.status).toBe("playing");
    expect(s.tiles).toHaveLength(1);
    expect(s.tiles[0].y).toBe(0);
    expect(s.tiles[0].x).toBeGreaterThan(0);
    expect(s.tiles[0].x).toBeLessThan(1);
    expect(s.tiles[0].text.startsWith("definition")).toBe(true);
    expect(s.tiles[0].answer.startsWith("term")).toBe(true);
    expect(s.lives).toBe(BLAST_LIVES);
    expect(s.lastTick).toBe(T0);
    expect(s.nextSpawnAt).toBe(T0 + spawnIntervalForLevel(1));
  });

  it("is over immediately with no usable terms", () => {
    expect(startBlast(createBlastState([]), T0).status).toBe("over");
  });

  it("can fall with terms instead of definitions", () => {
    const s = startBlast(createBlastState(makeTerms(3), { seed: 2, answerWith: "definition" }), T0);
    expect(s.tiles[0].text.startsWith("term")).toBe(true);
  });
});

describe("tickBlast", () => {
  it("moves tiles down proportionally to elapsed time", () => {
    const s = running();
    const speed = s.tiles[0].speed;
    const next = tickBlast(s, T0 + 100);
    expect(next.tiles[0].y).toBeCloseTo(speed * 100, 10);
    expect(next.lastTick).toBe(T0 + 100);
  });

  it("clamps huge frame gaps so a background tab does not drop every tile at once", () => {
    const s = running();
    const next = tickBlast(s, T0 + 60_000);
    expect(next.tiles[0].y).toBeLessThan(1);
  });

  it("spawns when the interval elapses, up to the concurrency cap", () => {
    let s = running(10);
    let t = T0;
    for (let i = 0; i < 40; i++) {
      t += 200;
      s = tickBlast(s, t);
    }
    expect(s.tiles.length).toBe(maxConcurrentForLevel(1));
    expect(new Set(s.tiles.map((x) => x.termId)).size).toBe(s.tiles.length);
  });

  it("costs a life when a tile lands and ends the game at zero lives", () => {
    let s = running(10);
    let t = T0;
    let lives = BLAST_LIVES;
    while (s.status === "playing") {
      t += 200;
      const before = s.lives;
      s = tickBlast(s, t);
      if (s.lives < before) {
        lives -= before - s.lives;
        expect(s.streak).toBe(0);
      }
    }
    expect(lives).toBe(0);
    expect(isBlastOver(s)).toBe(true);
    expect(s.tiles).toEqual([]);
    expect(s.misses).toBe(BLAST_LIVES);
    expect(tickBlast(s, t + 1000)).toBe(s);
  });

  it("prunes old pops", () => {
    let s = running(5);
    const tile = s.tiles[0];
    s = answerBlast(s, tile.answer, T0 + 10);
    expect(s.popped).toHaveLength(1);
    s = tickBlast(s, T0 + 10 + POP_TTL_MS + 1);
    expect(s.popped).toHaveLength(0);
  });
});

describe("answerBlast", () => {
  it("clears the matching tile, scores and builds a streak", () => {
    const s = running(5);
    const tile = s.tiles[0];
    const next = answerBlast(s, tile.answer.toUpperCase(), T0 + 10);
    expect(next.tiles).toHaveLength(0);
    expect(next.popped[0].id).toBe(tile.id);
    expect(next.score).toBe(pointsFor(1, 1));
    expect(next.streak).toBe(1);
    expect(next.bestStreak).toBe(1);
    expect(next.hits).toBe(1);
    expect(next.lastAnswer).toEqual({ input: tile.answer.toUpperCase(), hit: true, at: T0 + 10 });
  });

  it("clears the lowest matching tile first", () => {
    let s = running(10);
    let t = T0;
    while (s.tiles.length < 2) s = tickBlast(s, (t += 200));
    const [high, low] = s.tiles.slice().sort((a, b) => a.y - b.y);
    // Force both tiles to the same answer to test urgency ordering.
    const rigged: BlastState = { ...s, tiles: s.tiles.map((x) => ({ ...x, answer: "same" })) };
    const next = answerBlast(rigged, "same", t);
    expect(next.tiles.map((x) => x.id)).toEqual([high.id]);
    expect(next.popped[0].id).toBe(low.id);
  });

  it("resets the streak on a miss and ignores blanks", () => {
    let s = running(5);
    s = answerBlast(s, s.tiles[0].answer, T0 + 10);
    expect(s.streak).toBe(1);
    s = tickBlast(s, T0 + spawnIntervalForLevel(1) + 10);
    expect(s.tiles).toHaveLength(1);
    const missed = answerBlast(s, "zzz", T0 + 5000);
    expect(missed.streak).toBe(0);
    expect(missed.tiles).toHaveLength(1);
    expect(missed.lastAnswer?.hit).toBe(false);
    expect(missed.lives).toBe(BLAST_LIVES);
    expect(answerBlast(s, "   ", T0 + 5000)).toBe(s);
  });

  it("levels up every few hits", () => {
    let s = running(20);
    let t = T0;
    let hits = 0;
    while (hits < HITS_PER_LEVEL) {
      if (!s.tiles.length) {
        s = tickBlast(s, (t += 200));
        continue;
      }
      s = answerBlast(s, s.tiles[0].answer, t);
      hits++;
    }
    expect(s.level).toBe(2);
    expect(s.status).toBe("playing");
  });

  it("does nothing once the game is over", () => {
    const over: BlastState = { ...running(), status: "over" };
    expect(answerBlast(over, "term 0", T0)).toBe(over);
  });
});
