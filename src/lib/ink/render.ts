import type { Stroke } from "@/lib/db/types";
import { outlineFor, outlineToPath } from "./stroke";
import { isHighlighter } from "./tools";

/**
 * Path2D memoisation.
 *
 * Rebuilding a stroke's outline costs real time on long strokes, and the
 * committed layer redraws whole pages on undo, scroll, and zoom. Keyed by
 * stroke id; entries are dropped when the stroke is erased or edited.
 */
const pathCache = new Map<string, Path2D>();

export function pathFor(stroke: Stroke): Path2D {
  const cached = pathCache.get(stroke.id);
  if (cached) return cached;
  const path = outlineToPath(outlineFor(stroke));
  pathCache.set(stroke.id, path);
  return path;
}

export function invalidatePath(strokeId: string): void {
  pathCache.delete(strokeId);
}

export function clearPathCache(): void {
  pathCache.clear();
}

/**
 * Highlighter strokes paint beneath ink so they read as marking existing
 * writing rather than covering it — the same ordering Notability uses.
 */
export function sortForPaint(strokes: Stroke[]): Stroke[] {
  const under: Stroke[] = [];
  const over: Stroke[] = [];
  for (const s of strokes) (isHighlighter(s) ? under : over).push(s);
  return under.concat(over);
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  ctx.save();
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.opacity;
  // Highlighters multiply so overlapping passes darken like real marker ink
  // instead of flatly stacking.
  ctx.globalCompositeOperation = isHighlighter(stroke) ? "multiply" : "source-over";
  ctx.fill(pathFor(stroke));
  ctx.restore();
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  for (const stroke of sortForPaint(strokes)) drawStroke(ctx, stroke);
}

/** Draws the stroke currently under the pointer, straight from an outline. */
export function drawLiveOutline(
  ctx: CanvasRenderingContext2D,
  outline: number[][],
  color: string,
  opacity: number,
  highlighter: boolean,
): void {
  if (outline.length === 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = highlighter ? "multiply" : "source-over";
  ctx.fill(outlineToPath(outline));
  ctx.restore();
}

/** Sets up a canvas for the device pixel ratio and returns its context. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): CanvasRenderingContext2D | null {
  const targetW = Math.max(1, Math.round(width * dpr));
  const targetH = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  void width;
  void height;
}
