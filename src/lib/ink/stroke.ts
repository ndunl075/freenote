import { getStroke } from "perfect-freehand";
import { newId } from "@/lib/utils/id";
import type { Stroke } from "@/lib/db/types";
import { POINT_STRIDE, bboxOf, simplify } from "./geometry";
import { opacityFor, strokeOptions, type InkTool } from "./tools";

/**
 * Accumulates pointer samples into a finished `Stroke`.
 *
 * Kept deliberately allocation-light: `push` is called for every coalesced
 * pointer event, which on a 240Hz stylus means ~240 calls a second per stroke.
 */
export class StrokeBuilder {
  readonly tool: InkTool;
  readonly color: string;
  readonly size: number;
  readonly opacity: number;
  /** True once any sample reports real (non-synthetic) pressure. */
  private sawPressure = false;
  private points: number[] = [];
  private startedAt: number;

  constructor(tool: InkTool, color: string, size: number, startedAt = performance.now()) {
    this.tool = tool;
    this.color = color;
    this.size = size;
    this.opacity = opacityFor(tool);
    this.startedAt = startedAt;
  }

  get length(): number {
    return this.points.length / POINT_STRIDE;
  }

  get raw(): number[] {
    return this.points;
  }

  push(x: number, y: number, pressure: number): void {
    // Chromium reports 0.5 for mice and 0 for some pens before contact. Treat
    // a constant 0.5 as "no pressure data" and let perfect-freehand simulate.
    if (pressure > 0 && pressure !== 0.5) this.sawPressure = true;
    const p = pressure > 0 ? pressure : 0.5;

    // Drop samples that land on the previous point — they add storage and
    // produce zero-length segments that upset the outline generator.
    const n = this.points.length;
    if (n >= POINT_STRIDE) {
      const dx = x - this.points[n - POINT_STRIDE];
      const dy = y - this.points[n - POINT_STRIDE + 1];
      if (dx * dx + dy * dy < 0.01) return;
    }

    this.points.push(x, y, p);
  }

  /** Outline for the in-progress stroke, recomputed each frame. */
  outline(): number[][] {
    return getStroke(toTriples(this.points), {
      ...strokeOptions(this.tool, this.size, this.sawPressure),
      last: false,
    });
  }

  /** Finalise. Returns null for strokes too short to be intentional. */
  commit(recordingOffsetMs?: number): Stroke | null {
    if (this.length === 0) return null;

    // A single tap is a legitimate dot; anything else needs two points.
    const points = simplify(this.points, 0.55);
    const bbox = bboxOf(points);

    return {
      id: newId("stk"),
      tool: this.tool,
      color: this.color,
      size: this.size,
      opacity: this.opacity,
      points,
      bbox,
      ...(recordingOffsetMs !== undefined ? { t: recordingOffsetMs } : {}),
    };
  }
}

export function toTriples(points: number[]): number[][] {
  const out: number[][] = new Array(points.length / POINT_STRIDE);
  for (let i = 0, j = 0; i < points.length; i += POINT_STRIDE, j++) {
    out[j] = [points[i], points[i + 1], points[i + 2]];
  }
  return out;
}

/** Final outline for a committed stroke. Memoised by the renderer. */
export function outlineFor(stroke: Stroke): number[][] {
  const hasPressure = strokeHasPressure(stroke.points);
  return getStroke(toTriples(stroke.points), {
    ...strokeOptions(stroke.tool as InkTool, stroke.size, hasPressure),
    last: true,
  });
}

function strokeHasPressure(points: number[]): boolean {
  for (let i = 2; i < points.length; i += POINT_STRIDE) {
    if (points[i] > 0 && points[i] !== 0.5) return true;
  }
  return false;
}

/** Outline points → a fillable Path2D, closed with quadratic joins. */
export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length === 0) return path;

  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}
