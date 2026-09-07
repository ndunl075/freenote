import { getStroke } from "perfect-freehand";
import { newId } from "@/lib/utils/id";
import type { Stroke } from "@/lib/db/types";
import { nibPressure, tiltFromEvent } from "./dynamics";
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
  /** Previous sample, for the speed term in the nib dynamics. */
  private lastX = 0;
  private lastY = 0;
  private lastAt = 0;
  private started = false;

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

  /**
   * Records one pointer sample.
   *
   * The stored third value is not the raw pressure — it is the nib pressure
   * derived from pressure, speed and tilt together. Computing it here, once
   * per sample, means the expensive part happens at input rate rather than on
   * every repaint, and the stored stroke already carries its own dynamics.
   */
  push(x: number, y: number, pressure: number, tiltX = 0, tiltY = 0, at?: number): void {
    // Chromium reports 0.5 for mice and 0 for some pens before contact, so a
    // constant 0.5 means "this device has no pressure to give".
    if (pressure > 0 && pressure !== 0.5) this.sawPressure = true;

    const now = at ?? this.lastAt + 8;

    // Drop samples that land on the previous point — they add storage and
    // produce zero-length segments that upset the outline generator.
    const n = this.points.length;
    if (n >= POINT_STRIDE) {
      const dx = x - this.points[n - POINT_STRIDE];
      const dy = y - this.points[n - POINT_STRIDE + 1];
      if (dx * dx + dy * dy < 0.01) return;
    }

    let speed = 0;
    if (this.started) {
      const dt = Math.max(1, now - this.lastAt);
      speed = Math.hypot(x - this.lastX, y - this.lastY) / dt;
    }

    this.points.push(
      x,
      y,
      nibPressure({
        pressure,
        hasPressure: this.sawPressure,
        speed,
        tilt: tiltFromEvent(tiltX, tiltY),
      }),
    );

    this.lastX = x;
    this.lastY = y;
    this.lastAt = now;
    this.started = true;
  }

  /**
   * Outline for the in-progress stroke, recomputed each frame.
   *
   * `predicted` carries points the browser expects the pointer to reach before
   * the next frame lands. Drawing them makes the ink appear to keep up with
   * the nib instead of trailing it — the single largest contributor to writing
   * feeling responsive. They are never committed, so a wrong guess costs
   * nothing beyond one frame.
   */
  outline(predicted?: number[]): number[][] {
    const points =
      predicted && predicted.length ? this.points.concat(predicted) : this.points;
    return getStroke(toTriples(points), {
      ...strokeOptions(this.tool, this.size),
      last: false,
    });
  }

  /** Finalise. Returns null for strokes too short to be intentional. */
  commit(recordingOffsetMs?: number): Stroke | null {
    if (this.length === 0) return null;

    // A single tap is a legitimate dot; anything else needs two points.
    // Simplify gently: the tolerance trades stored size against the fine
    // detail that carries a stroke's character, and 0.55 was shaving it.
    const points = simplify(this.points, 0.3);
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
  return getStroke(toTriples(stroke.points), {
    ...strokeOptions(stroke.tool as InkTool, stroke.size),
    last: true,
  });
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
