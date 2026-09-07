import { describe, expect, it } from "vitest";
import { buildChoices, pickDistractors, shapeScore } from "./distractors";
import { createRng } from "./random";

describe("shapeScore", () => {
  it("scores similar-shaped strings lower", () => {
    expect(shapeScore("tibia", "femur")).toBeLessThan(shapeScore("the long bone of the thigh", "femur"));
    expect(shapeScore("1945", "1939")).toBeLessThan(shapeScore("Treaty of Versailles", "1939"));
  });
});

describe("pickDistractors", () => {
  const rng = createRng(7);

  it("never includes the answer or anything that normalises to it", () => {
    const pool = ["Paris", "paris!", "London", "Berlin", "Madrid"];
    const out = pickDistractors("Paris", pool, 3, rng);
    expect(out).not.toContain("Paris");
    expect(out).not.toContain("paris!");
    expect(out).toHaveLength(3);
  });

  it("never repeats an option", () => {
    const pool = ["London", "london", "LONDON", "Berlin", "Madrid", "Rome"];
    const out = pickDistractors("Paris", pool, 3, rng);
    const keys = out.map((s) => s.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns everything available when the pool is small", () => {
    expect(pickDistractors("a", ["b", "c"], 3, rng).sort()).toEqual(["b", "c"]);
    expect(pickDistractors("a", [], 3, rng)).toEqual([]);
  });

  it("prefers candidates of similar length and word count", () => {
    const pool = [
      "tibia",
      "ulna",
      "radius",
      "the long curved bone that forms part of the rib cage",
      "a flat bone at the front of the chest connecting the ribs",
      "the bone that runs from the shoulder to the elbow in humans",
    ];
    for (let seed = 0; seed < 10; seed++) {
      const out = pickDistractors("femur", pool, 3, createRng(seed));
      expect(out.sort()).toEqual(["radius", "tibia", "ulna"]);
    }
  });

  it("is deterministic for a given rng", () => {
    const pool = ["b", "c", "d", "e", "f", "g"];
    expect(pickDistractors("a", pool, 3, createRng(3))).toEqual(
      pickDistractors("a", pool, 3, createRng(3)),
    );
  });
});

describe("buildChoices", () => {
  it("includes the answer exactly once in a shuffled list of the requested size", () => {
    const out = buildChoices("femur", ["tibia", "ulna", "radius", "fibula"], 4, createRng(1));
    expect(out).toHaveLength(4);
    expect(out.filter((o) => o === "femur")).toHaveLength(1);
  });

  it("shrinks gracefully with a tiny pool", () => {
    expect(buildChoices("femur", ["tibia"], 4, createRng(1)).sort()).toEqual(["femur", "tibia"]);
    expect(buildChoices("femur", [], 4, createRng(1))).toEqual(["femur"]);
  });
});
