"use client";

import { useCallback, useEffect, useRef } from "react";
import type { NoteObject, Page, PaperColor, PaperStyle } from "@/lib/db";
import { PAGE_WIDTH } from "@/lib/db";
import { newId } from "@/lib/utils/id";
import {
  StrokeBuilder,
  clearCanvas,
  drawLiveOutline,
  drawPaper,
  drawStrokes,
  prepareCanvas,
  recognizeShape,
  selectWithLasso,
  strokesHitByEraser,
  type InkTool,
  type ToolId,
} from "@/lib/ink";
import { isGesturing, touchDown, touchUp } from "./gestures";
import { useEditor } from "./store";
import { useRecording } from "./recordingStore";

/* ============================================================================
   A single page.

   Two stacked canvases:
     committed — paper plus every finished stroke. Repainted only when the page
                 actually changes, which is what keeps long notes cheap.
     live      — the stroke currently under the pointer, cleared every frame.

   Splitting them is the whole performance story: without it, drawing the 900th
   stroke would repaint the previous 899 on every pointermove.
   ========================================================================= */

/** How long the pen must sit still before a stroke is treated as a shape. */
const HOLD_TO_SNAP_MS = 450;

/** Converts a recognised shape into a placeable note object. */
function toShapeObject(
  shape: NonNullable<ReturnType<typeof recognizeShape>>,
  color: string,
  strokeWidth: number,
): NoteObject {
  const base = { kind: "shape" as const, id: newId("obj"), color, strokeWidth, fill: null };

  if (shape.kind === "rect") {
    return { ...base, shape: "rect", x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  if (shape.kind === "ellipse") {
    return {
      ...base,
      shape: "ellipse",
      x: shape.cx - shape.rx,
      y: shape.cy - shape.ry,
      width: shape.rx * 2,
      height: shape.ry * 2,
    };
  }
  // The line renderer draws bottom-left to top-right inside its box, so the
  // box is the segment's bounding rectangle.
  return {
    ...base,
    shape: "line",
    x: Math.min(shape.x1, shape.x2),
    y: Math.min(shape.y1, shape.y2),
    width: Math.abs(shape.x2 - shape.x1),
    height: Math.abs(shape.y2 - shape.y1),
  };
}

interface PageCanvasProps {
  page: Page;
  paper: PaperStyle;
  paperColor: PaperColor;
  width: number;
}

export function PageCanvas({ page, paper, paperColor, width }: PageCanvasProps) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const builderRef = useRef<StrokeBuilder | null>(null);
  const eraserPathRef = useRef<number[]>([]);
  const lassoPathRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);
  const activePointerRef = useRef<number | null>(null);
  /** Strokes erased during the current swipe, so we only commit once on lift. */
  const pendingEraseRef = useRef<Set<string>>(new Set());
  /** Points the browser predicts the pointer will reach; drawn, never stored. */
  const predictedRef = useRef<number[]>([]);
  /** Tool to restore when a stylus eraser signal ends. */
  const springBackToolRef = useRef<ToolId | null>(null);
  /**
   * When the pointer last actually moved — a dwell before lift means "snap".
   * Read from the event's own timeStamp rather than a clock, so it records
   * when the input happened rather than when the handler got scheduled.
   */
  const lastMotionRef = useRef(0);

  const height = page.height;
  const revision = useEditor((s) => s.revision);

  /* --- Committed layer ---------------------------------------------------- */

  useEffect(() => {
    const canvas = committedRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, width, height);
    if (!ctx) return;

    clearCanvas(ctx, width, height);

    // Paper is painted into the canvas rather than layered as CSS so that
    // export-to-image gets the page background for free.
    const scale = width / PAGE_WIDTH;
    ctx.save();
    ctx.scale(scale, scale);
    drawPaper(ctx, paper, paperColor, PAGE_WIDTH, height / scale);
    drawStrokes(ctx, page.strokes);
    ctx.restore();
  }, [page, paper, paperColor, width, height, revision]);

  /* --- Coordinate mapping ------------------------------------------------- */

  /** Client coords → page coords, undoing the CSS scale of the page. */
  const toPage = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const rect = liveRef.current?.getBoundingClientRect();
      if (!rect) return [0, 0];
      const scale = PAGE_WIDTH / width;
      return [(clientX - rect.left) * scale, (clientY - rect.top) * scale];
    },
    [width],
  );

  const scaleFactor = width / PAGE_WIDTH;

  /* --- Live rendering ----------------------------------------------------- */

  const paintLive = useCallback(() => {
    frameRef.current = null;
    const canvas = liveRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, width, height);
    if (!ctx) return;

    clearCanvas(ctx, width, height);
    const builder = builderRef.current;
    if (!builder) return;

    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);
    drawLiveOutline(
      ctx,
      builder.outline(predictedRef.current),
      builder.color,
      builder.opacity,
      builder.tool === "highlighter",
    );
    ctx.restore();
  }, [width, height, scaleFactor]);

  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, width, height);
    if (!ctx) return;
    clearCanvas(ctx, width, height);

    const { tool, eraserSize } = useEditor.getState();

    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);

    if (tool === "lasso" && lassoPathRef.current.length >= 4) {
      const path = lassoPathRef.current;
      // Read the accent from the live theme so the lasso matches light and
      // dark. Only on frames where a lasso is actually being drawn, so this
      // never touches the pen's hot path.
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() ||
        "#007aff";
      ctx.beginPath();
      ctx.moveTo(path[0], path[1]);
      for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
      ctx.closePath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (tool === "eraser" && eraserPathRef.current.length >= 2) {
      const path = eraserPathRef.current;
      const x = path[path.length - 2];
      const y = path[path.length - 1];
      ctx.beginPath();
      ctx.arc(x, y, eraserSize, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(60, 60, 67, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fill();
    }

    ctx.restore();
  }, [width, height, scaleFactor]);

  const requestPaint = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      paintLive();
      paintOverlay();
    });
  }, [paintLive, paintOverlay]);

  // Size the interaction layers' backing stores on mount and on resize. Doing
  // this lazily inside the paint functions would leave them unsized until the
  // first pointer event, which is the event they are meant to receive.
  useEffect(() => {
    if (liveRef.current) prepareCanvas(liveRef.current, width, height);
    if (overlayRef.current) prepareCanvas(overlayRef.current, width, height);
  }, [width, height]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  /* --- Pointer handling --------------------------------------------------- */

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = useEditor.getState();

    if (e.pointerType === "touch") {
      const fingers = touchDown(e.pointerId);
      // Two fingers belong to the gesture layer. Abandon anything the first
      // finger had started so a pinch never leaves a stray mark.
      if (fingers >= 2) {
        abandonStroke();
        return;
      }
      // Palm rejection, and the hand tool, both hand touch to the scroller.
      if (state.stylusOnly || state.tool === "hand") return;
    }

    // Right-click never draws.
    if (e.button !== 0 && e.pointerType === "mouse") return;

    // A stylus reporting its eraser end, or holding its barrel button, erases
    // for as long as it is held and springs back to the previous tool on lift.
    // Apple Pencil's squeeze is not exposed to web browsers at all; this is the
    // closest thing the platform actually gives us.
    const eraserSignal =
      e.pointerType === "pen" && (e.button === 5 || (e.buttons & 32) !== 0);
    if (eraserSignal && state.tool !== "eraser") {
      springBackToolRef.current = state.tool;
      state.setTool("eraser");
    }
    if (
      state.tool === "hand" ||
      state.tool === "text" ||
      state.tool === "sticky" ||
      state.tool === "image"
    ) {
      return;
    }
    if (activePointerRef.current !== null) return;

    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    const [x, y] = toPage(e.clientX, e.clientY);

    if (state.tool === "eraser") {
      eraserPathRef.current = [x, y];
      pendingEraseRef.current = new Set();
      applyErase();
    } else if (state.tool === "lasso") {
      lassoPathRef.current = [x, y];
    } else {
      const tool = state.tool as InkTool;
      const isHl = tool === "highlighter";
      builderRef.current = new StrokeBuilder(
        tool,
        isHl ? state.highlighterColor : state.color,
        isHl ? state.highlighterSize : state.size,
      );
      lastMotionRef.current = e.nativeEvent.timeStamp;
      // The stylus's own eraser end maps to the eraser regardless of tool.
      builderRef.current.push(x, y, e.pressure);
    }
    requestPaint();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();

    // Coalesced events recover the samples the browser batched between frames.
    // On a 240Hz stylus this is the difference between smooth ink and facets.
    // A second finger mid-stroke means the user started a pinch.
    if (e.pointerType === "touch" && isGesturing()) {
      abandonStroke();
      return;
    }

    const events =
      typeof e.nativeEvent.getCoalescedEvents === "function"
        ? e.nativeEvent.getCoalescedEvents()
        : [e.nativeEvent];

    const state = useEditor.getState();

    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = toPage(ev.clientX, ev.clientY);
      if (state.tool === "eraser") eraserPathRef.current.push(x, y);
      else if (state.tool === "lasso") lassoPathRef.current.push(x, y);
      else {
        const before = builderRef.current?.length ?? 0;
        builderRef.current?.push(x, y, ev.pressure, ev.tiltX ?? 0, ev.tiltY ?? 0, ev.timeStamp);
        // push() drops samples that land on the previous point, so a growing
        // length is exactly "the pen actually moved".
        if ((builderRef.current?.length ?? 0) > before) {
          lastMotionRef.current = ev.timeStamp;
        }
      }
    }

    // Points the browser expects the pointer to reach before the next frame.
    // Drawing them makes ink keep up with the nib rather than trail it.
    predictedRef.current = [];
    if (state.tool !== "eraser" && state.tool !== "lasso") {
      const predict =
        typeof e.nativeEvent.getPredictedEvents === "function"
          ? e.nativeEvent.getPredictedEvents()
          : [];
      for (const ev of predict) {
        const [px, py] = toPage(ev.clientX, ev.clientY);
        predictedRef.current.push(px, py, 0.5);
      }
    }

    if (state.tool === "eraser") applyErase();
    requestPaint();
  };

  const applyErase = () => {
    const { eraserSize } = useEditor.getState();
    const hit = strokesHitByEraser(page.strokes, eraserPathRef.current, eraserSize);
    for (const id of hit) pendingEraseRef.current.add(id);
    if (hit.size > 0) {
      // Commit immediately so the ink disappears under the cursor; the whole
      // swipe still coalesces into one undo step via the pending set.
      useEditor.getState().eraseStrokes(page.id, hit);
    }
  };

  /** Throw away the in-progress stroke without committing it. */
  const abandonStroke = () => {
    activePointerRef.current = null;
    builderRef.current = null;
    predictedRef.current = [];
    eraserPathRef.current = [];
    lassoPathRef.current = [];
    requestPaint();
  };

  const releaseSpringBackTool = () => {
    if (springBackToolRef.current) {
      useEditor.getState().setTool(springBackToolRef.current);
      springBackToolRef.current = null;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") touchUp(e.pointerId);
    releaseSpringBackTool();
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }

    const store = useEditor.getState();

    if (store.tool === "lasso") {
      const path = lassoPathRef.current;
      if (path.length >= 6) {
        const selection = selectWithLasso(page.strokes, page.objects, path);
        store.setSelection(selection.strokeIds.size || selection.objectIds.size ? page.id : null, selection);
      }
      lassoPathRef.current = [];
    } else if (store.tool === "eraser") {
      eraserPathRef.current = [];
      pendingEraseRef.current.clear();
    } else {
      const builder = builderRef.current;
      const held = e.nativeEvent.timeStamp - lastMotionRef.current;

      // Hold the pen still at the end of a stroke and freenote snaps it to a
      // clean shape, the way Notability does. Only after a deliberate dwell:
      // snapping on every stroke would mangle handwriting.
      const snapped =
        builder && held >= HOLD_TO_SNAP_MS && builder.tool !== "highlighter"
          ? recognizeShape(builder.raw)
          : null;

      builderRef.current = null;

      if (snapped && builder) {
        store.addObject(page.id, toShapeObject(snapped, builder.color, builder.size));
      } else {
        // Stamp the audio offset so playback can replay this stroke in time.
        const stroke = builder?.commit(useRecording.getState().offsetForStroke());
        if (stroke) store.commitStroke(page.id, stroke);
      }
    }

    requestPaint();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") touchUp(e.pointerId);
    releaseSpringBackTool();
    if (activePointerRef.current !== e.pointerId) return;
    abandonStroke();
  };

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[2px] shadow-[var(--shadow-md)]"
      style={{ width, height }}
    >
      {/* A canvas is a replaced element: absolutely positioned with inset-0
          and width:auto it resolves to its intrinsic 300x150 instead of
          stretching. Every layer therefore gets an explicit CSS size. */}
      <canvas
        ref={committedRef}
        className="absolute left-0 top-0"
        style={{ width, height }}
        aria-hidden
      />
      <canvas
        ref={liveRef}
        className="absolute left-0 top-0"
        style={{ width, height }}
        aria-hidden
      />
      <canvas
        ref={overlayRef}
        className="ink-surface absolute left-0 top-0"
        style={{ width, height }}
        role="application"
        aria-label={`Page ${page.index + 1}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
