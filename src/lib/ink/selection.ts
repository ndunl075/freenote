import type { NoteObject, Stroke } from "@/lib/db/types";
import {
  POINT_STRIDE,
  bboxContains,
  bboxIntersects,
  bboxOf,
  distanceToSegmentSq,
  expandBBox,
  pointInPolygon,
  pointNearStroke,
  segmentsIntersect,
  translatePoints,
  type BBox,
} from "./geometry";

/* --- Erasing -------------------------------------------------------------- */

/**
 * Stroke eraser: removes any stroke the eraser path crosses.
 *
 * Notability's eraser deletes whole strokes rather than pixels, which is why
 * it feels forgiving — you swipe roughly through a mistake and the whole
 * letter goes, instead of leaving ragged fragments.
 */
export function strokesHitByEraser(
  strokes: Stroke[],
  eraserPath: number[],
  radius: number,
): Set<string> {
  const hit = new Set<string>();
  if (eraserPath.length < 2) return hit;

  const pathBox = expandBBox(flatBBox(eraserPath), radius);

  for (const stroke of strokes) {
    if (!bboxIntersects(expandBBox(stroke.bbox, radius + stroke.size), pathBox)) continue;
    if (eraserTouchesStroke(stroke, eraserPath, radius + stroke.size / 2)) hit.add(stroke.id);
  }
  return hit;
}

function eraserTouchesStroke(stroke: Stroke, eraserPath: number[], radius: number): boolean {
  // A tap (single eraser sample) is a proximity test.
  if (eraserPath.length === 2) {
    return pointNearStroke(stroke.points, eraserPath[0], eraserPath[1], radius);
  }

  const rSq = radius * radius;

  for (let e = 0; e + 3 < eraserPath.length; e += 2) {
    const ex0 = eraserPath[e];
    const ey0 = eraserPath[e + 1];
    const ex1 = eraserPath[e + 2];
    const ey1 = eraserPath[e + 3];

    // A single-point stroke (a dot) has no segments to cross.
    if (stroke.points.length === POINT_STRIDE) {
      if (distanceToSegmentSq(stroke.points[0], stroke.points[1], ex0, ey0, ex1, ey1) <= rSq) {
        return true;
      }
      continue;
    }

    for (let s = 0; s + POINT_STRIDE * 2 - 1 < stroke.points.length; s += POINT_STRIDE) {
      const sx0 = stroke.points[s];
      const sy0 = stroke.points[s + 1];
      const sx1 = stroke.points[s + POINT_STRIDE];
      const sy1 = stroke.points[s + POINT_STRIDE + 1];

      if (segmentsIntersect(ex0, ey0, ex1, ey1, sx0, sy0, sx1, sy1)) return true;

      // Crossing alone misses a fat eraser passing close to a short stroke.
      if (
        distanceToSegmentSq(sx0, sy0, ex0, ey0, ex1, ey1) <= rSq ||
        distanceToSegmentSq(ex0, ey0, sx0, sy0, sx1, sy1) <= rSq
      ) {
        return true;
      }
    }
  }
  return false;
}

/* --- Lasso ---------------------------------------------------------------- */

export interface Selection {
  strokeIds: Set<string>;
  objectIds: Set<string>;
  bounds: BBox;
}

export const EMPTY_SELECTION: Selection = {
  strokeIds: new Set(),
  objectIds: new Set(),
  bounds: [0, 0, 0, 0],
};

/**
 * Lasso selection. A stroke is selected when *most* of it falls inside the
 * loop — requiring every point makes the tool infuriating to use, and
 * requiring one point grabs neighbours you didn't mean to include.
 */
export function selectWithLasso(
  strokes: Stroke[],
  objects: NoteObject[],
  lasso: number[],
  threshold = 0.6,
): Selection {
  const strokeIds = new Set<string>();
  const objectIds = new Set<string>();
  if (lasso.length < 6) return EMPTY_SELECTION;

  const lassoBox = flatBBox(lasso);
  const boxes: BBox[] = [];

  for (const stroke of strokes) {
    if (!bboxIntersects(stroke.bbox, lassoBox)) continue;

    let inside = 0;
    let total = 0;
    for (let i = 0; i < stroke.points.length; i += POINT_STRIDE) {
      total++;
      if (pointInPolygon(lasso, stroke.points[i], stroke.points[i + 1])) inside++;
    }
    if (total > 0 && inside / total >= threshold) {
      strokeIds.add(stroke.id);
      boxes.push(stroke.bbox);
    }
  }

  for (const obj of objects) {
    const box = objectBBox(obj);
    if (!bboxIntersects(box, lassoBox)) continue;
    // Objects are rectangles: select when the centre is captured.
    const cx = (box[0] + box[2]) / 2;
    const cy = (box[1] + box[3]) / 2;
    if (pointInPolygon(lasso, cx, cy)) {
      objectIds.add(obj.id);
      boxes.push(box);
    }
  }

  return { strokeIds, objectIds, bounds: unionBBox(boxes) };
}

/** Rectangular marquee, the shift-drag alternative to the lasso. */
export function selectWithRect(
  strokes: Stroke[],
  objects: NoteObject[],
  rect: BBox,
): Selection {
  const strokeIds = new Set<string>();
  const objectIds = new Set<string>();
  const boxes: BBox[] = [];

  for (const stroke of strokes) {
    if (bboxContains(rect, stroke.bbox)) {
      strokeIds.add(stroke.id);
      boxes.push(stroke.bbox);
    }
  }
  for (const obj of objects) {
    const box = objectBBox(obj);
    if (bboxContains(rect, box)) {
      objectIds.add(obj.id);
      boxes.push(box);
    }
  }
  return { strokeIds, objectIds, bounds: unionBBox(boxes) };
}

export function moveSelection(
  strokes: Stroke[],
  objects: NoteObject[],
  selection: Selection,
  dx: number,
  dy: number,
): { strokes: Stroke[]; objects: NoteObject[] } {
  const movedStrokes = strokes.map((s) => {
    if (!selection.strokeIds.has(s.id)) return s;
    const points = translatePoints(s.points, dx, dy);
    return { ...s, points, bbox: bboxOf(points) };
  });

  const movedObjects = objects.map((o) =>
    selection.objectIds.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o,
  );

  return { strokes: movedStrokes, objects: movedObjects };
}

export function objectBBox(obj: NoteObject): BBox {
  const height =
    obj.kind === "text" ? Math.max(24, obj.fontSize * 1.6) : (obj as { height: number }).height;
  const width = obj.kind === "text" ? obj.width : (obj as { width: number }).width;
  return [obj.x, obj.y, obj.x + width, obj.y + height];
}

export function unionBBox(boxes: BBox[]): BBox {
  if (boxes.length === 0) return [0, 0, 0, 0];
  let [minX, minY, maxX, maxY] = boxes[0];
  for (let i = 1; i < boxes.length; i++) {
    const b = boxes[i];
    if (b[0] < minX) minX = b[0];
    if (b[1] < minY) minY = b[1];
    if (b[2] > maxX) maxX = b[2];
    if (b[3] > maxY) maxY = b[3];
  }
  return [minX, minY, maxX, maxY];
}

export function isSelectionEmpty(s: Selection): boolean {
  return s.strokeIds.size === 0 && s.objectIds.size === 0;
}

/** BBox of a flat [x, y, ...] pair array (lasso and eraser paths). */
function flatBBox(flat: number[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    if (flat[i] < minX) minX = flat[i];
    if (flat[i] > maxX) maxX = flat[i];
    if (flat[i + 1] < minY) minY = flat[i + 1];
    if (flat[i + 1] > maxY) maxY = flat[i + 1];
  }
  return [minX, minY, maxX, maxY];
}
