import { describe, expect, it } from "vitest";
import type { NoteObject, Page, Stroke } from "@/lib/db/types";
import {
  bboxOf,
  distanceToSegmentSq,
  pointInPolygon,
  pointNearStroke,
  segmentsIntersect,
  simplify,
  translatePoints,
} from "./geometry";
import { strokesHitByEraser, selectWithLasso, selectWithRect, moveSelection } from "./selection";
import { History, apply, invert } from "./history";
import { sortForPaint } from "./render";

/** A horizontal line from (x0,y) to (x1,y), sampled every pixel. */
function line(x0: number, y: number, x1: number, id = "s"): Stroke {
  const points: number[] = [];
  for (let x = x0; x <= x1; x++) points.push(x, y, 0.5);
  return {
    id,
    tool: "pen",
    color: "#000",
    size: 2,
    opacity: 1,
    points,
    bbox: bboxOf(points),
  };
}

describe("geometry", () => {
  it("computes a bbox over the flat point array", () => {
    expect(bboxOf([0, 0, 0.5, 10, 20, 0.5, -5, 3, 0.5])).toEqual([-5, 0, 10, 20]);
  });

  it("returns a zero bbox for an empty stroke", () => {
    expect(bboxOf([])).toEqual([0, 0, 0, 0]);
  });

  it("clamps segment distance to the endpoints", () => {
    // Perpendicular within the segment.
    expect(distanceToSegmentSq(5, 3, 0, 0, 10, 0)).toBeCloseTo(9);
    // Past the end: distance to the endpoint, not the infinite line.
    expect(distanceToSegmentSq(15, 0, 0, 0, 10, 0)).toBeCloseTo(25);
    // Degenerate segment.
    expect(distanceToSegmentSq(3, 4, 0, 0, 0, 0)).toBeCloseTo(25);
  });

  it("detects proximity to a stroke centreline", () => {
    const s = line(0, 50, 100);
    expect(pointNearStroke(s.points, 50, 52, 5)).toBe(true);
    expect(pointNearStroke(s.points, 50, 70, 5)).toBe(false);
  });

  it("handles a single-point stroke as a dot", () => {
    expect(pointNearStroke([10, 10, 0.5], 12, 10, 5)).toBe(true);
    expect(pointNearStroke([10, 10, 0.5], 30, 10, 5)).toBe(false);
  });

  it("detects crossing and non-crossing segments", () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segmentsIntersect(0, 0, 5, 5, 6, 6, 10, 10)).toBe(false);
  });

  it("tests point-in-polygon", () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(pointInPolygon(square, 5, 5)).toBe(true);
    expect(pointInPolygon(square, 15, 5)).toBe(false);
  });

  it("simplifies a straight line down to its endpoints", () => {
    const s = line(0, 0, 100);
    const simplified = simplify(s.points, 0.5);
    expect(simplified.length / 3).toBe(2);
    // Endpoints must survive exactly.
    expect(simplified[0]).toBe(0);
    expect(simplified[3]).toBe(100);
  });

  it("keeps the corner of an L-shaped stroke", () => {
    const points: number[] = [];
    for (let x = 0; x <= 50; x++) points.push(x, 0, 0.5);
    for (let y = 1; y <= 50; y++) points.push(50, y, 0.5);

    const simplified = simplify(points, 0.5);
    const count = simplified.length / 3;
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThan(10);

    // The corner point must be preserved.
    const hasCorner = Array.from({ length: count }, (_, i) => [
      simplified[i * 3],
      simplified[i * 3 + 1],
    ]).some(([x, y]) => x === 50 && y === 0);
    expect(hasCorner).toBe(true);
  });

  it("leaves strokes of fewer than three points untouched", () => {
    expect(simplify([1, 2, 0.5], 1)).toEqual([1, 2, 0.5]);
  });

  it("translates points without disturbing pressure", () => {
    expect(translatePoints([0, 0, 0.7, 10, 10, 0.3], 5, -5)).toEqual([
      5, -5, 0.7, 15, 5, 0.3,
    ]);
  });
});

describe("eraser", () => {
  const strokes = [line(0, 50, 100, "a"), line(0, 200, 100, "b")];

  it("erases only the stroke the swipe crosses", () => {
    const hit = strokesHitByEraser(strokes, [50, 20, 50, 80], 4);
    expect([...hit]).toEqual(["a"]);
  });

  it("erases nothing when the swipe misses everything", () => {
    expect(strokesHitByEraser(strokes, [50, 300, 50, 400], 4).size).toBe(0);
  });

  it("erases on a tap within radius", () => {
    expect([...strokesHitByEraser(strokes, [50, 52], 6)]).toEqual(["a"]);
    expect(strokesHitByEraser(strokes, [50, 90], 6).size).toBe(0);
  });

  it("erases a dot stroke the swipe passes through", () => {
    const dot: Stroke = {
      id: "dot",
      tool: "pen",
      color: "#000",
      size: 2,
      opacity: 1,
      points: [50, 50, 0.5],
      bbox: [50, 50, 50, 50],
    };
    expect([...strokesHitByEraser([dot], [40, 50, 60, 50], 3)]).toEqual(["dot"]);
  });

  it("erases both strokes when the swipe crosses both", () => {
    expect(strokesHitByEraser(strokes, [50, 20, 50, 250], 4).size).toBe(2);
  });
});

describe("lasso selection", () => {
  const strokes = [line(10, 20, 40, "inside"), line(200, 300, 240, "outside")];
  const objects: NoteObject[] = [
    {
      kind: "sticky",
      id: "note",
      x: 15,
      y: 15,
      width: 20,
      height: 20,
      text: "hi",
      color: "#ffe14d",
    },
  ];
  const loop = [0, 0, 60, 0, 60, 60, 0, 60];

  it("selects strokes mostly inside the loop", () => {
    const sel = selectWithLasso(strokes, objects, loop);
    expect([...sel.strokeIds]).toEqual(["inside"]);
  });

  it("selects an object whose centre is captured", () => {
    expect([...selectWithLasso(strokes, objects, loop).objectIds]).toEqual(["note"]);
  });

  it("ignores a stroke only clipped by the loop edge", () => {
    // Mostly outside: only its left tail enters the loop.
    const straddling = line(50, 30, 300, "straddle");
    const sel = selectWithLasso([straddling], [], loop);
    expect(sel.strokeIds.size).toBe(0);
  });

  it("returns an empty selection for a degenerate loop", () => {
    expect(selectWithLasso(strokes, objects, [0, 0]).strokeIds.size).toBe(0);
  });

  it("reports the union bounds of what it selected", () => {
    const sel = selectWithLasso(strokes, [], loop);
    expect(sel.bounds).toEqual([10, 20, 40, 20]);
  });

  it("marquee-selects only fully contained strokes", () => {
    const sel = selectWithRect(strokes, [], [0, 0, 60, 60]);
    expect([...sel.strokeIds]).toEqual(["inside"]);
  });

  it("moves a selection and updates its bbox", () => {
    const sel = selectWithLasso(strokes, objects, loop);
    const moved = moveSelection(strokes, objects, sel, 100, 5);

    const target = moved.strokes.find((s) => s.id === "inside")!;
    expect(target.bbox).toEqual([110, 25, 140, 25]);
    // Untouched stroke keeps its position.
    expect(moved.strokes.find((s) => s.id === "outside")!.bbox).toEqual([200, 300, 240, 300]);
    expect(moved.objects[0].x).toBe(115);
  });
});

describe("paint order", () => {
  it("puts highlighter beneath ink", () => {
    const pen = { ...line(0, 0, 10, "pen"), tool: "pen" as const };
    const hl = { ...line(0, 0, 10, "hl"), tool: "highlighter" as const };
    expect(sortForPaint([pen, hl]).map((s) => s.id)).toEqual(["hl", "pen"]);
  });
});

describe("history", () => {
  const emptyPage = (): Page => ({
    id: "p",
    noteId: "n",
    index: 0,
    height: 1056,
    strokes: [],
    objects: [],
  });

  it("inverts every command type back to itself in two steps", () => {
    const stroke = line(0, 0, 10, "x");
    const commands = [
      { kind: "add-strokes", strokes: [stroke] },
      { kind: "remove-strokes", strokes: [stroke] },
      { kind: "move", strokeIds: ["x"], objectIds: [], dx: 5, dy: 5 },
    ] as const;

    for (const c of commands) {
      expect(invert(invert(c))).toEqual(c);
    }
  });

  it("undoes and redoes a stroke", () => {
    const history = new History();
    const stroke = line(0, 0, 10, "x");

    let page = apply(emptyPage(), { kind: "add-strokes", strokes: [stroke] });
    history.push({ kind: "add-strokes", strokes: [stroke] });
    expect(page.strokes).toHaveLength(1);

    page = history.undo(page)!;
    expect(page.strokes).toHaveLength(0);
    expect(history.canRedo).toBe(true);

    page = history.redo(page)!;
    expect(page.strokes).toHaveLength(1);
  });

  it("returns null when there is nothing left to undo", () => {
    const history = new History();
    expect(history.undo(emptyPage())).toBeNull();
    expect(history.canUndo).toBe(false);
  });

  it("discards the redo branch once a new edit lands", () => {
    const history = new History();
    const a = line(0, 0, 10, "a");
    const b = line(0, 20, 10, "b");

    let page = apply(emptyPage(), { kind: "add-strokes", strokes: [a] });
    history.push({ kind: "add-strokes", strokes: [a] });
    page = history.undo(page)!;
    expect(history.canRedo).toBe(true);

    page = apply(page, { kind: "add-strokes", strokes: [b] });
    history.push({ kind: "add-strokes", strokes: [b] });

    expect(history.canRedo).toBe(false);
  });

  it("undoes a move by shifting back, bbox included", () => {
    const history = new History();
    const stroke = line(0, 0, 10, "x");
    const command = { kind: "move" as const, strokeIds: ["x"], objectIds: [], dx: 7, dy: 3 };

    let page: Page = { ...emptyPage(), strokes: [stroke] };
    page = apply(page, command);
    history.push(command);
    expect(page.strokes[0].bbox).toEqual([7, 3, 17, 3]);

    page = history.undo(page)!;
    expect(page.strokes[0].bbox).toEqual([0, 0, 10, 0]);
    expect(page.strokes[0].points.slice(0, 3)).toEqual([0, 0, 0.5]);
  });

  it("bounds the undo depth", () => {
    const history = new History();
    for (let i = 0; i < 250; i++) {
      history.push({ kind: "add-strokes", strokes: [line(0, i, 5, `s${i}`)] });
    }
    let page: Page = emptyPage();
    let undos = 0;
    while (history.canUndo) {
      page = history.undo(page)!;
      undos++;
      if (undos > 300) break;
    }
    expect(undos).toBe(200);
  });
});
