import type { PaperColor, PaperStyle } from "@/lib/db/types";

const PAPER_FILLS: Record<PaperColor, { bg: string; line: string; margin: string; ink: string }> = {
  white: { bg: "#ffffff", line: "#c9d4e3", margin: "#f2b8b5", ink: "#1a1a1a" },
  cream: { bg: "#fdf8ec", line: "#d9cdb2", margin: "#e8b5a8", ink: "#2b2415" },
  yellow: { bg: "#fdf6cf", line: "#d8cd8e", margin: "#e0a08e", ink: "#2b2810" },
  gray: { bg: "#eceef2", line: "#c2c7d2", margin: "#e0a8a5", ink: "#1a1c22" },
  black: { bg: "#14161c", line: "#333844", margin: "#6b3d3a", ink: "#f2f4f8" },
};

export function paperPalette(color: PaperColor) {
  return PAPER_FILLS[color];
}

/** Default ink colour that stays legible on the chosen paper. */
export function defaultInkFor(color: PaperColor): string {
  return PAPER_FILLS[color].ink;
}

const LINE_HEIGHTS: Partial<Record<PaperStyle, number>> = {
  "lined-narrow": 24,
  "lined-wide": 32,
  cornell: 32,
};

const GRID_SIZE = 24;
const DOT_SPACING = 24;

/** Left margin rule, three quarters of an inch in at 96dpi. */
const MARGIN_X = 72;

/**
 * Paints the page background. Drawn straight to the committed canvas rather
 * than layered as CSS so that PDF/PNG export gets the paper for free.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  style: PaperStyle,
  color: PaperColor,
  width: number,
  height: number,
): void {
  const palette = PAPER_FILLS[color];

  ctx.save();
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;

  switch (style) {
    case "blank":
      break;

    case "lined-narrow":
    case "lined-wide": {
      const gap = LINE_HEIGHTS[style]!;
      horizontalRules(ctx, width, height, gap, gap * 2);

      // The red margin rule down the left. Notability's ruled paper has one,
      // and so does the library's paper preview — without it here the two
      // disagree about what the same page looks like.
      ctx.strokeStyle = palette.margin;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(roundHalf(MARGIN_X), 0);
      ctx.lineTo(roundHalf(MARGIN_X), height);
      ctx.stroke();
      break;
    }

    case "cornell": {
      const gap = LINE_HEIGHTS.cornell!;
      const cueWidth = width * 0.28;
      const summaryTop = height - 140;

      horizontalRules(ctx, width, summaryTop, gap, gap * 2);

      // Cue column and summary band — Cornell's defining structure.
      ctx.strokeStyle = palette.margin;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cueWidth, 0);
      ctx.lineTo(cueWidth, summaryTop);
      ctx.moveTo(0, summaryTop);
      ctx.lineTo(width, summaryTop);
      ctx.stroke();
      break;
    }

    case "grid": {
      ctx.beginPath();
      for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
        ctx.moveTo(roundHalf(x), 0);
        ctx.lineTo(roundHalf(x), height);
      }
      for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
        ctx.moveTo(0, roundHalf(y));
        ctx.lineTo(width, roundHalf(y));
      }
      ctx.stroke();
      break;
    }

    case "dotted": {
      ctx.fillStyle = palette.line;
      for (let x = DOT_SPACING; x < width; x += DOT_SPACING) {
        for (let y = DOT_SPACING; y < height; y += DOT_SPACING) {
          ctx.beginPath();
          ctx.arc(x, y, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case "music": {
      // Staves of five rules, grouped with generous gaps between systems.
      const staffGap = 9;
      const systemGap = 60;
      let y = 60;
      while (y + staffGap * 4 < height - 40) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ly = roundHalf(y + i * staffGap);
          ctx.moveTo(40, ly);
          ctx.lineTo(width - 40, ly);
        }
        ctx.stroke();
        y += staffGap * 4 + systemGap;
      }
      break;
    }
  }

  ctx.restore();
}

function horizontalRules(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gap: number,
  top: number,
): void {
  ctx.beginPath();
  for (let y = top; y < height; y += gap) {
    ctx.moveTo(0, roundHalf(y));
    ctx.lineTo(width, roundHalf(y));
  }
  ctx.stroke();
}

/** Snap to a half-pixel so 1px rules render crisp instead of blurred. */
function roundHalf(v: number): number {
  return Math.round(v) + 0.5;
}

export const PAPER_STYLES: { id: PaperStyle; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "lined-wide", label: "Wide ruled" },
  { id: "lined-narrow", label: "Narrow ruled" },
  { id: "grid", label: "Grid" },
  { id: "dotted", label: "Dotted" },
  { id: "cornell", label: "Cornell" },
  { id: "music", label: "Music" },
];

export const PAPER_COLORS: { id: PaperColor; label: string; swatch: string }[] = [
  { id: "white", label: "White", swatch: PAPER_FILLS.white.bg },
  { id: "cream", label: "Cream", swatch: PAPER_FILLS.cream.bg },
  { id: "yellow", label: "Yellow", swatch: PAPER_FILLS.yellow.bg },
  { id: "gray", label: "Gray", swatch: PAPER_FILLS.gray.bg },
  { id: "black", label: "Black", swatch: PAPER_FILLS.black.bg },
];
