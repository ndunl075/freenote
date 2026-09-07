import { POINT_STRIDE, bboxOf, pointCount } from "./geometry";

/* ============================================================================
   Shape recognition

   Notability's nicest small feature: draw a rough shape, hold the pen still,
   and it snaps to a clean one. The trick is being conservative — a recogniser
   that fires on ordinary handwriting is worse than none at all, because it
   destroys work the user meant to keep. Every threshold here errs toward
   returning null and leaving the ink alone.
   ========================================================================= */

export type RecognizedShape =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

/** Flat [x, y, pressure, ...] → [[x, y], ...]. */
function toXY(points: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i += POINT_STRIDE) out.push([points[i], points[i + 1]]);
  return out;
}

function pathLength(pts: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return total;
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** How well the points fit an ellipse inscribed in their bounding box. */
function ellipseError(pts: [number, number][], box: [number, number, number, number]): number {
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  const rx = (box[2] - box[0]) / 2;
  const ry = (box[3] - box[1]) / 2;
  if (rx <= 0 || ry <= 0) return Infinity;

  let sum = 0;
  for (const [x, y] of pts) {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    // Radial distance from the unit circle; 0 means a perfect fit.
    sum += Math.abs(Math.hypot(nx, ny) - 1);
  }
  return sum / pts.length;
}

/** How well the points hug the perimeter of their bounding box. */
function rectError(pts: [number, number][], box: [number, number, number, number]): number {
  const [minX, minY, maxX, maxY] = box;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return Infinity;
  const scale = Math.max(w, h);

  let sum = 0;
  for (const [x, y] of pts) {
    // Distance to the nearest edge of the box.
    const d = Math.min(x - minX, maxX - x, y - minY, maxY - y);
    sum += Math.abs(d) / scale;
  }
  return sum / pts.length;
}

export interface RecognizeOptions {
  /** Minimum size in px; below this a stroke is probably a letter, not a shape. */
  minSize?: number;
}

/**
 * Attempts to read a stroke as a geometric shape. Returns null whenever it is
 * not confident, which is the common case and the correct default.
 */
export function recognizeShape(
  points: number[],
  { minSize = 40 }: RecognizeOptions = {},
): RecognizedShape | null {
  if (pointCount(points) < 8) return null;

  const pts = toXY(points);
  const box = bboxOf(points);
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  const diagonal = Math.hypot(width, height);

  if (Math.max(width, height) < minSize) return null;

  const length = pathLength(pts);
  if (length < minSize) return null;

  const gap = distance(pts[0], pts[pts.length - 1]);
  const closed = gap < diagonal * 0.25;

  /* --- Open strokes: only a straight line is safe to claim --------------- */
  if (!closed) {
    const straightness = distance(pts[0], pts[pts.length - 1]) / length;
    if (straightness > 0.93) {
      return {
        kind: "line",
        x1: pts[0][0],
        y1: pts[0][1],
        x2: pts[pts.length - 1][0],
        y2: pts[pts.length - 1][1],
      };
    }
    return null;
  }

  /* --- Closed strokes ---------------------------------------------------- */

  // A closed stroke whose path is far longer than its perimeter is a scribble,
  // not a shape someone drew once.
  if (length > 2 * (width + height) * 1.35) return null;

  const eErr = ellipseError(pts, box);
  const rErr = rectError(pts, box);

  // Prefer whichever model fits better, and refuse both if neither fits well.
  if (rErr < 0.05 && rErr < eErr) {
    return { kind: "rect", x: box[0], y: box[1], width, height };
  }
  if (eErr < 0.12 && eErr <= rErr) {
    return {
      kind: "ellipse",
      cx: (box[0] + box[2]) / 2,
      cy: (box[1] + box[3]) / 2,
      rx: width / 2,
      ry: height / 2,
    };
  }

  return null;
}
