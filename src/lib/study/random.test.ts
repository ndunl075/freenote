import { describe, expect, it } from "vitest";
import { createRng, nextSeed, pick, sample, seedFrom, shuffle } from "./random";

describe("createRng", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, createRng(9));
    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.slice().sort((x, y) => x - y)).toEqual(input);
    expect(out).not.toEqual(input);
  });
});

describe("sample / pick / seeds", () => {
  it("samples without replacement", () => {
    const out = sample(["a", "b", "c", "d"], 2, createRng(1));
    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(2);
  });

  it("picks undefined from an empty list", () => {
    expect(pick([], createRng(1))).toBeUndefined();
    expect(pick(["x"], createRng(1))).toBe("x");
  });

  it("hashes strings to stable seeds", () => {
    expect(seedFrom("set_abc")).toBe(seedFrom("set_abc"));
    expect(seedFrom("set_abc")).not.toBe(seedFrom("set_abd"));
    expect(Number.isInteger(nextSeed(createRng(5)))).toBe(true);
  });
});
