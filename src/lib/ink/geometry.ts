/* ============================================================================
   Geometry helpers for ink hit-testing.

   Strokes are stored as a flat [x, y, pressure, ...] array. Everything here
   works directly on that layout — no intermediate object allocation, because
   these functions run inside pointermove handlers against thousands of points.
   ========================================================================= */

export type BBox = [minX: number, minY: number, maxX: number, maxY: number];

export const POINT_STRIDE = 3;

export function pointCount(points: number[]): number {
  return Math.floor(points.length / POINT_STRIDE);
}

export function bboxOf(points: number[]): BBox {
  if (points.length === 0) return [0, 0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += POINT_STRIDE) {
    const x = points[i];
    const y = points[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function expandBBox(box: BBox, by: number): BBox {
  return [box[0] - by, box[1] - by, box[2] + by, box[3] + by];
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

export function bboxContains(outer: BBox, inner: BBox): boolean {
  return (
    outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]
  );
}

export function bboxContainsPoint(box: BBox, x: number, y: number): boolean {
  return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
}

/** Squared distance from point (px,py) to segment (ax,ay)-(bx,by). Squared to
 *  avoid a sqrt in the inner loop; callers compare against squared radii. */
export function distanceToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  // Degenerate segment: fall back to point distance.
  if (lenSq === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return ddx * ddx + ddy * ddy;
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy;
}

/** True when the point lies within `radius` of the stroke's centreline. */
export function pointNearStroke(
  points: number[],
  px: number,
  py: number,
  radius: number,
): boolean {
  const n = pointCount(points);
  if (n === 0) return false;
  const rSq = radius * radius;

  if (n === 1) {
    const dx = px - points[0];
    const dy = py - points[1];
    return dx * dx + dy * dy <= rSq;
  }

  for (let i = 0; i + POINT_STRIDE * 2 - 1 < points.length; i += POINT_STRIDE) {
    if (
      distanceToSegmentSq(
        px,
        py,
        points[i],
        points[i + 1],
        points[i + POINT_STRIDE],
        points[i + POINT_STRIDE + 1],
      ) <= rSq
    ) {
      return true;
    }
  }
  return false;
}

/** Do two segments cross? Used by the stroke eraser's swipe path. */
export function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Collinear touching cases.
  return (
    (d1 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) ||
    (d2 === 0 && onSegment(cx, cy, dx, dy, bx, by)) ||
    (d3 === 0 && onSegment(ax, ay, bx, by, cx, cy)) ||
    (d4 === 0 && onSegment(ax, ay, bx, by, dx, dy))
  );
}

function cross(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function onSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): boolean {
  return (
    Math.min(ax, bx) <= px &&
    px <= Math.max(ax, bx) &&
    Math.min(ay, by) <= py &&
    py <= Math.max(ay, by)
  );
}

/** Ray-casting point-in-polygon, for lasso selection. `poly` is flat [x,y,...]. */
export function pointInPolygon(poly: number[], px: number, py: number): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2];
    const yi = poly[i * 2 + 1];
    const xj = poly[j * 2];
    const yj = poly[j * 2 + 1];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Ramer–Douglas–Peucker simplification over the flat point array.
 * Long strokes carry far more samples than they need; simplifying on commit
 * keeps stored notes small without any visible change to the ink.
 */
export function simplify(points: number[], tolerance = 0.6): number[] {
  const n = pointCount(points);
  if (n < 3) return points.slice();

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: [number, number][] = [[0, n - 1]];
  const tolSq = tolerance * tolerance;

  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDistSq = 0;
    let index = -1;

    const ax = points[first * POINT_STRIDE];
    const ay = points[first * POINT_STRIDE + 1];
    const bx = points[last * POINT_STRIDE];
    const by = points[last * POINT_STRIDE + 1];

    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegmentSq(
        points[i * POINT_STRIDE],
        points[i * POINT_STRIDE + 1],
        ax,
        ay,
        bx,
        by,
      );
      if (d > maxDistSq) {
        maxDistSq = d;
        index = i;
      }
    }

    if (index !== -1 && maxDistSq > tolSq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      out.push(
        points[i * POINT_STRIDE],
        points[i * POINT_STRIDE + 1],
        points[i * POINT_STRIDE + 2],
      );
    }
  }
  return out;
}

export function translatePoints(points: number[], dx: number, dy: number): number[] {
  const out = points.slice();
  for (let i = 0; i < out.length; i += POINT_STRIDE) {
    out[i] += dx;
    out[i + 1] += dy;
  }
  return out;
}

/** Scale about an origin — used when a lasso selection is resized. */
export function scalePoints(
  points: number[],
  originX: number,
  originY: number,
  sx: number,
  sy: number,
): number[] {
  const out = points.slice();
  for (let i = 0; i < out.length; i += POINT_STRIDE) {
    out[i] = originX + (out[i] - originX) * sx;
    out[i + 1] = originY + (out[i + 1] - originY) * sy;
  }
  return out;
}
