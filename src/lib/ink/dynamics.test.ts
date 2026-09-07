import { describe, expect, it } from "vitest";
import { nibPressure, speedToWidth, tiltFromEvent, tiltToBreadth } from "./dynamics";

describe("speedToWidth", () => {
  it("is thickest when barely moving and thinnest when flicking", () => {
    expect(speedToWidth(0)).toBeCloseTo(1, 2);
    expect(speedToWidth(2.5)).toBeCloseTo(0, 2);
  });

  it("decreases monotonically with speed", () => {
    const samples = [0, 0.2, 0.4, 0.8, 1.2, 1.6].map(speedToWidth);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
  });

  it("puts ordinary handwriting speed in the expressive middle", () => {
    // A linear ramp would pin normal writing near one end; the easing is the
    // reason the stroke has any variation to show.
    const w = speedToWidth(0.7);
    expect(w).toBeGreaterThan(0.2);
    expect(w).toBeLessThan(0.8);
  });
});

describe("tiltToBreadth", () => {
  it("ignores an upright stylus", () => {
    expect(tiltToBreadth(0)).toBe(0);
    expect(tiltToBreadth(25)).toBe(0);
  });

  it("widens as the pencil lies over", () => {
    expect(tiltToBreadth(60)).toBeGreaterThan(0);
    expect(tiltToBreadth(80)).toBeGreaterThan(tiltToBreadth(60));
  });

  it("treats tilt as unsigned", () => {
    expect(tiltToBreadth(-70)).toBeCloseTo(tiltToBreadth(70));
  });
});

describe("nibPressure", () => {
  const base = { pressure: 0.5, hasPressure: true, speed: 0.5, tilt: 0 };

  it("lets pressure lead when the device reports it", () => {
    const light = nibPressure({ ...base, pressure: 0.2 });
    const heavy = nibPressure({ ...base, pressure: 0.9 });
    expect(heavy).toBeGreaterThan(light + 0.4);
  });

  it("falls back entirely to speed without pressure data", () => {
    const slow = nibPressure({ pressure: 0.5, hasPressure: false, speed: 0.05, tilt: 0 });
    const fast = nibPressure({ pressure: 0.5, hasPressure: false, speed: 2, tilt: 0 });
    expect(slow).toBeGreaterThan(0.9);
    expect(fast).toBeLessThan(0.1);
    // Reported pressure must be ignored when it is known to be meaningless.
    expect(nibPressure({ pressure: 0.1, hasPressure: false, speed: 0.05, tilt: 0 })).toBe(slow);
  });

  it("still varies with speed for a stylus, but only a little", () => {
    const slow = nibPressure({ ...base, speed: 0.05 });
    const fast = nibPressure({ ...base, speed: 2 });
    expect(slow).toBeGreaterThan(fast);
    // Pressure, not speed, is the dominant signal for a pen.
    expect(slow - fast).toBeLessThan(0.35);
  });

  it("only ever adds breadth from tilt", () => {
    const upright = nibPressure({ ...base, tilt: 0 });
    const laid = nibPressure({ ...base, tilt: 75 });
    expect(laid).toBeGreaterThan(upright);
  });

  it("never leaves the 0..1 range", () => {
    for (const p of [-1, 0, 0.5, 1, 2]) {
      for (const s of [0, 1, 10]) {
        for (const t of [0, 45, 90]) {
          const v = nibPressure({ pressure: p, hasPressure: true, speed: s, tilt: t });
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("tiltFromEvent", () => {
  it("reports zero for an upright pointer", () => {
    expect(tiltFromEvent(0, 0)).toBe(0);
  });

  it("combines both axes", () => {
    expect(tiltFromEvent(30, 40)).toBeCloseTo(50);
  });

  it("clamps at 90 degrees", () => {
    expect(tiltFromEvent(80, 80)).toBe(90);
  });
});
