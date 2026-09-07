"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Page, PaperColor, PaperStyle } from "@/lib/db";
import { PAGE_WIDTH } from "@/lib/db";
import {
  StrokeBuilder,
  clearCanvas,
  drawLiveOutline,
  drawPaper,
  drawStrokes,
  prepareCanvas,
  selectWithLasso,
  strokesHitByEraser,
  type InkTool,
} from "@/lib/ink";
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
      builder.outline(),
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
      ctx.beginPath();
      ctx.moveTo(path[0], path[1]);
      for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
      ctx.closePath();
      ctx.strokeStyle = "#4255ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.fillStyle = "rgba(66, 85, 255, 0.08)";
      ctx.fill();
    }

    if (tool === "eraser" && eraserPathRef.current.length >= 2) {
      const path = eraserPathRef.current;
      const x = path[path.length - 2];
      const y = path[path.length - 1];
      ctx.beginPath();
      ctx.arc(x, y, eraserSize, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(10, 9, 45, 0.45)";
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

    // Palm rejection: with a stylus in use, touch scrolls instead of drawing.
    if (state.stylusOnly && e.pointerType === "touch") return;
    // Never draw with a right-click or a stylus eraser barrel button.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (state.tool === "hand" || state.tool === "text" || state.tool === "image") return;
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
    const events =
      typeof e.nativeEvent.getCoalescedEvents === "function"
        ? e.nativeEvent.getCoalescedEvents()
        : [e.nativeEvent];

    const state = useEditor.getState();

    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = toPage(ev.clientX, ev.clientY);
      if (state.tool === "eraser") eraserPathRef.current.push(x, y);
      else if (state.tool === "lasso") lassoPathRef.current.push(x, y);
      else builderRef.current?.push(x, y, ev.pressure);
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

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
      // Stamp the audio offset so playback can replay this stroke in time.
      const stroke = builderRef.current?.commit(useRecording.getState().offsetForStroke());
      builderRef.current = null;
      if (stroke) store.commitStroke(page.id, stroke);
    }

    requestPaint();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    builderRef.current = null;
    eraserPathRef.current = [];
    lassoPathRef.current = [];
    requestPaint();
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
