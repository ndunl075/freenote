import { describe, expect, it } from "vitest";
import { OneEuroFilter, PointFilter, filterFor } from "./filter";

const DT = 1 / 120;

/** Deterministic pseudo-jitter, so the test is repeatable. */
const jitter = (i: number, amount = 0.8) => Math.sin(i * 12.9898) * amount;

describe("OneEuroFilter", () => {
  it("passes the first sample through untouched", () => {
    expect(new OneEuroFilter().filter(42, DT)).toBe(42);
  });

  it("removes jitter from a line that should be straight", () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0.007 });
    let rawError = 0;
    let filteredError = 0;

    for (let i = 0; i < 120; i++) {
      const truth = 100; // holding still
      const noisy = truth + jitter(i);
      const out = f.filter(noisy, DT);
      if (i > 20) {
        rawError += Math.abs(noisy - truth);
        filteredError += Math.abs(out - truth);
      }
    }
    // The whole point: much less deviation than the raw signal carried.
    expect(filteredError).toBeLessThan(rawError * 0.4);
  });

  it("still tracks a fast movement closely", () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0.02 });
    let value = 0;
    let out = 0;
    for (let i = 0; i < 60; i++) {
      value += 12; // a brisk stroke
      out = f.filter(value, DT);
    }
    // Lag must stay small, or ink visibly trails the nib.
    expect(Math.abs(value - out)).toBeLessThan(12);
  });

  it("smooths a slow move more than a fast one", () => {
    const lag = (stepPerFrame: number) => {
      const f = new OneEuroFilter({ minCutoff: 1, beta: 0.02 });
      let v = 0;
      let out = 0;
      for (let i = 0; i < 40; i++) {
        v += stepPerFrame;
        out = f.filter(v, DT);
      }
      return (v - out) / stepPerFrame; // lag measured in frames
    };
    // Adaptive cutoff means the fast stroke should lag fewer frames.
    expect(lag(20)).toBeLessThan(lag(0.5));
  });

  it("survives a zero or negative time step", () => {
    const f = new OneEuroFilter();
    f.filter(0, DT);
    expect(Number.isFinite(f.filter(10, 0))).toBe(true);
    expect(Number.isFinite(f.filter(20, -1))).toBe(true);
  });

  it("starts clean after a reset", () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 30; i++) f.filter(500, DT);
    f.reset();
    expect(f.filter(10, DT)).toBe(10);
  });

  it("converges on a held value", () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i < 200; i++) out = f.filter(7, DT);
    expect(out).toBeCloseTo(7, 3);
  });
});

describe("PointFilter", () => {
  it("filters both axes independently", () => {
    const f = new PointFilter();
    expect(f.filter(3, 9, DT)).toEqual([3, 9]);
    const [x, y] = f.filter(4, 10, DT);
    expect(x).toBeGreaterThan(3);
    expect(y).toBeGreaterThan(9);
  });

  it("resets both axes", () => {
    const f = new PointFilter();
    for (let i = 0; i < 20; i++) f.filter(100, 100, DT);
    f.reset();
    expect(f.filter(1, 2, DT)).toEqual([1, 2]);
  });
});

describe("filterFor", () => {
  it("smooths a finger more than a stylus", () => {
    const wobble = (type: string) => {
      const f = filterFor(type);
      let error = 0;
      for (let i = 0; i < 120; i++) {
        const [x] = f.filter(50 + jitter(i), 50, DT);
        if (i > 20) error += Math.abs(x - 50);
      }
      return error;
    };
    // A blunt, shaky input needs more help than a precise one.
    expect(wobble("touch")).toBeLessThan(wobble("pen"));
  });

  it("returns a working filter for an unknown pointer type", () => {
    expect(filterFor("mouse").filter(5, 5, DT)).toEqual([5, 5]);
  });
});
