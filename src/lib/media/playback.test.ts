import { describe, expect, it } from "vitest";
import type { Stroke } from "@/lib/db/types";
import { activeStrokeAt, activityHistogram, buildMarks, strokesAt } from "./playback";

const stroke = (id: string, t?: number): Stroke => ({
  id,
  tool: "pen",
  color: "#000",
  size: 2,
  opacity: 1,
  points: [0, 0, 0.5],
  bbox: [0, 0, 0, 0],
  ...(t === undefined ? {} : { t }),
});

describe("ink/audio sync", () => {
  const strokes = [stroke("pre"), stroke("a", 1000), stroke("b", 5000), stroke("c", 9000)];

  it("reveals strokes written up to a point in the audio", () => {
    expect(strokesAt(strokes, 5000).map((s) => s.id)).toEqual(["pre", "a", "b"]);
  });

  it("always shows strokes written before recording started", () => {
    // A stroke with no offset predates the recording and must never vanish.
    expect(strokesAt(strokes, 0).map((s) => s.id)).toEqual(["pre"]);
  });

  it("finds the stroke to highlight at a given time", () => {
    expect(activeStrokeAt(strokes, 6000)?.id).toBe("b");
    expect(activeStrokeAt(strokes, 999)).toBeNull();
  });

  it("builds marks sorted by time, ignoring untimed strokes", () => {
    const marks = buildMarks([stroke("z", 9000), stroke("pre"), stroke("y", 100)]);
    expect(marks).toEqual([
      { strokeId: "y", t: 100 },
      { strokeId: "z", t: 9000 },
    ]);
  });

  it("normalises the activity histogram against its own peak", () => {
    const marks = [
      { strokeId: "1", t: 0 },
      { strokeId: "2", t: 10 },
      { strokeId: "3", t: 20 },
      { strokeId: "4", t: 900 },
    ];
    const hist = activityHistogram(marks, 1000, 10);
    expect(hist).toHaveLength(10);
    expect(Math.max(...hist)).toBe(1);
    expect(hist[0]).toBe(1); // three marks land in the first bucket
    expect(hist[9]).toBeCloseTo(1 / 3);
  });

  it("returns an empty histogram for a zero-length recording", () => {
    expect(activityHistogram([{ strokeId: "1", t: 0 }], 0, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it("clamps a mark at the very end into the last bucket", () => {
    const hist = activityHistogram([{ strokeId: "1", t: 1000 }], 1000, 4);
    expect(hist[3]).toBe(1);
  });
});
