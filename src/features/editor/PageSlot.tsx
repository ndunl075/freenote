"use client";

import type { Page, PaperColor, PaperStyle } from "@/lib/db";
import { paperPalette } from "@/lib/ink";
import { ObjectLayer } from "./ObjectLayer";
import { PageCanvas } from "./PageCanvas";
import { SelectionOverlay } from "./SelectionOverlay";
import { useNearViewport } from "./useVisible";

/**
 * One page in the scroller. Mounts its canvases only when it is near the
 * viewport; otherwise it reserves exactly the same space with a plain paper
 * rectangle, so scroll position never jumps as pages swap in and out.
 */
export function PageSlot({
  page,
  paper,
  paperColor,
  width,
  height,
  eager,
}: {
  page: Page;
  paper: PaperStyle;
  paperColor: PaperColor;
  width: number;
  height: number;
  /** Render immediately on mount — used for the pages already on screen. */
  eager?: boolean;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>(eager);

  return (
    <div ref={ref} className="relative" style={{ width, height }}>
      {near ? (
        <>
          <PageCanvas page={page} paper={paper} paperColor={paperColor} width={width} />
          <ObjectLayer page={page} width={width} />
          <SelectionOverlay pageId={page.id} width={width} />
        </>
      ) : (
        <div
          className="h-full w-full rounded-[2px] shadow-[var(--shadow-md)]"
          style={{ background: paperPalette(paperColor).bg }}
          aria-hidden
        />
      )}
    </div>
  );
}
