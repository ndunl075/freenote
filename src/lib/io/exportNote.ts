import type { Note, Page } from "@/lib/db/types";
import { PAGE_WIDTH } from "@/lib/db/notes";
import { drawPaper } from "@/lib/ink/paper";
import { drawStrokes } from "@/lib/ink/render";
import { buildPdf, type PdfPageImage } from "./pdf";

/* ============================================================================
   Rendering notes to images and PDF.

   Shares the exact drawing code the editor uses, so an exported page is the
   same pixels the user was looking at rather than a second implementation that
   drifts.
   ========================================================================= */

/** Render one page to an offscreen canvas at `scale`× logical size. */
export function renderPage(note: Note, page: Page, scale = 2): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_WIDTH * scale);
  canvas.height = Math.round(page.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(scale, scale);
  drawPaper(ctx, note.paper, note.paperColor, PAGE_WIDTH, page.height);
  drawStrokes(ctx, page.strokes);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      type,
      quality,
    );
  });
}

export async function exportPagePng(note: Note, page: Page, scale = 2): Promise<Blob> {
  return canvasToBlob(renderPage(note, page, scale), "image/png");
}

export async function exportNotePdf(note: Note, pages: Page[], scale = 2): Promise<Blob> {
  const images: PdfPageImage[] = [];

  for (const page of pages) {
    const canvas = renderPage(note, page, scale);
    // JPEG rather than PNG: DCTDecode lets the compressed bytes pass straight
    // into the PDF with no re-encoding, and paper plus ink has no transparency
    // to preserve.
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    images.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      widthPx: canvas.width,
      heightPx: canvas.height,
    });
  }

  return buildPdf(images);
}

/** Small data URL for the library grid. Cheap enough to regenerate on save. */
export function renderThumbnail(note: Note, page: Page, width = 220): string {
  const scale = width / PAGE_WIDTH;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(page.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.scale(scale, scale);
  drawPaper(ctx, note.paper, note.paperColor, PAGE_WIDTH, page.height);
  drawStrokes(ctx, page.strokes);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Filesystem-safe filename derived from the note title. */
export function safeFilename(title: string, extension: string): string {
  const base = title.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
  return `${base || "note"}.${extension}`;
}
