import { describe, expect, it } from "vitest";
import { recognizeShape } from "./recognize";

/** Builds a flat [x, y, pressure, ...] array from xy pairs. */
const flat = (pts: [number, number][]): number[] =>
  pts.flatMap(([x, y]) => [x, y, 0.5]);

/** Adds deterministic wobble so shapes look hand-drawn, not machine-perfect. */
function jitter(pts: [number, number][], amount = 2): [number, number][] {
  return pts.map(([x, y], i) => [
    x + Math.sin(i * 2.399) * amount,
    y + Math.cos(i * 1.732) * amount,
  ]);
}

function circle(cx: number, cy: number, r: number, n = 60): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * Math.PI * 2;
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r] as [number, number];
  });
}

function rectangle(x: number, y: number, w: number, h: number, per = 20): [number, number][] {
  const pts: [number, number][] = [];
  const edge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) => {
    for (let i = 0; i < per; i++) {
      const t = i / per;
      pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
  pts.push([x, y]);
  return pts;
}

function segment(x1: number, y1: number, x2: number, y2: number, n = 30): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] as [number, number];
  });
}

describe("recognizeShape", () => {
  it("recognises a hand-drawn circle as an ellipse", () => {
    const shape = recognizeShape(flat(jitter(circle(200, 200, 90))));
    expect(shape?.kind).toBe("ellipse");
    if (shape?.kind === "ellipse") {
      expect(shape.cx).toBeCloseTo(200, -1);
      expect(shape.rx).toBeCloseTo(90, -1);
    }
  });

  it("recognises a squashed circle as an ellipse with different radii", () => {
    const oval = circle(0, 0, 1, 80).map(
      ([x, y]) => [200 + x * 140, 200 + y * 60] as [number, number],
    );
    const shape = recognizeShape(flat(jitter(oval)));
    expect(shape?.kind).toBe("ellipse");
    if (shape?.kind === "ellipse") {
      expect(shape.rx).toBeGreaterThan(shape.ry * 1.8);
    }
  });

  it("recognises a hand-drawn rectangle", () => {
    const shape = recognizeShape(flat(jitter(rectangle(50, 60, 220, 140), 1.5)));
    expect(shape?.kind).toBe("rect");
    if (shape?.kind === "rect") {
      expect(shape.width).toBeCloseTo(220, -1);
      expect(shape.height).toBeCloseTo(140, -1);
    }
  });

  it("recognises a straight-ish line", () => {
    const shape = recognizeShape(flat(jitter(segment(20, 20, 300, 90), 1.5)));
    expect(shape?.kind).toBe("line");
    if (shape?.kind === "line") {
      expect(shape.x1).toBeCloseTo(20, -1);
      expect(shape.x2).toBeCloseTo(300, -1);
    }
  });

  it("leaves handwriting alone", () => {
    // A cursive-ish squiggle: open, long, and nowhere near straight.
    const squiggle: [number, number][] = Array.from({ length: 80 }, (_, i) => [
      20 + i * 3,
      100 + Math.sin(i / 2) * 26,
    ]);
    expect(recognizeShape(flat(squiggle))).toBeNull();
  });

  it("leaves a scribble alone", () => {
    // Closed, but with far more path length than its perimeter.
    const scribble: [number, number][] = [];
    for (let i = 0; i < 200; i++) {
      const t = (i / 200) * Math.PI * 12;
      scribble.push([150 + Math.cos(t) * 60, 150 + Math.sin(t * 1.7) * 60]);
    }
    scribble.push(scribble[0]);
    expect(recognizeShape(flat(scribble))).toBeNull();
  });

  it("ignores strokes too small to be a deliberate shape", () => {
    // The size of a letter, not a diagram.
    expect(recognizeShape(flat(circle(10, 10, 8)))).toBeNull();
  });

  it("ignores strokes with too few samples to judge", () => {
    expect(recognizeShape(flat([[0, 0], [100, 0], [100, 100]]))).toBeNull();
  });

  it("does not claim a curved open stroke is a line", () => {
    const arc: [number, number][] = Array.from({ length: 40 }, (_, i) => {
      const t = (i / 39) * Math.PI * 0.8;
      return [100 + Math.cos(t) * 120, 200 + Math.sin(t) * 120];
    });
    expect(recognizeShape(flat(arc))).toBeNull();
  });

  it("prefers a rectangle over an ellipse for a boxy stroke", () => {
    const shape = recognizeShape(flat(rectangle(0, 0, 200, 200)));
    expect(shape?.kind).toBe("rect");
  });

  it("prefers an ellipse over a rectangle for a round stroke", () => {
    const shape = recognizeShape(flat(circle(300, 300, 100)));
    expect(shape?.kind).toBe("ellipse");
  });

  it("respects a custom minimum size", () => {
    // 30px across: under the 40px default floor, over an explicit 20px one.
    const small = circle(50, 50, 15);
    expect(recognizeShape(flat(small))).toBeNull();
    expect(recognizeShape(flat(small), { minSize: 20 })?.kind).toBe("ellipse");
  });
});
