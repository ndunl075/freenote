import type { Stroke } from "@/lib/db/types";

export type ToolId =
  | "pen"
  | "highlighter"
  | "marker"
  | "eraser"
  | "lasso"
  | "text"
  | "shape"
  | "sticky"
  | "image"
  | "hand";

export type InkTool = Extract<ToolId, "pen" | "highlighter" | "marker">;

export interface ToolPreset {
  tool: InkTool;
  color: string;
  size: number;
  opacity: number;
}

/** Notability's ink palette. Ordered as it appears in the colour tray. */
export const INK_COLORS = [
  "#1a1a1a",
  "#007aff",
  "#e02d2d",
  "#0f9d58",
  "#f5a623",
  "#9b51e0",
  "#e91e8c",
  "#8b5a2b",
  "#00b8d4",
  "#ffffff",
] as const;

/** Sticky note colours, matching the highlighter tray's warmth. */
export const STICKY_COLORS = ["#ffe14d", "#ffd0e0", "#c6f0c2", "#c9e4ff", "#e6d6ff"] as const;

export const HIGHLIGHTER_COLORS = [
  "#ffe14d",
  "#7bf59a",
  "#7fd6ff",
  "#ff9ecb",
  "#ffb37a",
  "#c9a7ff",
] as const;

/** Nib sizes, in CSS px at 100% zoom. */
export const PEN_SIZES = [1, 2, 3, 5, 8] as const;
export const HIGHLIGHTER_SIZES = [12, 18, 26, 34] as const;
export const ERASER_SIZES = [8, 16, 28, 44] as const;

export const DEFAULT_PRESETS: ToolPreset[] = [
  { tool: "pen", color: "#1a1a1a", size: 2, opacity: 1 },
  { tool: "pen", color: "#007aff", size: 2, opacity: 1 },
  { tool: "pen", color: "#e02d2d", size: 3, opacity: 1 },
  { tool: "highlighter", color: "#ffe14d", size: 18, opacity: 0.4 },
];

/**
 * Per-tool stroke physics fed to perfect-freehand.
 *
 * A pen tapers hard with pressure and thins on fast strokes — that speed
 * thinning is what makes handwriting look like a real nib rather than a
 * uniform tube. A highlighter does the opposite: constant width, no taper,
 * because a chisel tip doesn't vary.
 */
export interface StrokeOptions {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
  simulatePressure: boolean;
  capStart: boolean;
  capEnd: boolean;
  taperStart: number;
  taperEnd: number;
}

export function strokeOptions(tool: InkTool, size: number): StrokeOptions {
  switch (tool) {
    case "highlighter":
      return {
        size,
        thinning: 0,
        smoothing: 0.6,
        streamline: 0.32,
        simulatePressure: false,
        capStart: false,
        capEnd: false,
        taperStart: 0,
        taperEnd: 0,
      };
    case "marker":
      return {
        size,
        thinning: 0.2,
        smoothing: 0.6,
        streamline: 0.3,
        simulatePressure: false,
        capStart: true,
        capEnd: true,
        taperStart: 0,
        taperEnd: 0,
      };
    case "pen":
    default:
      return {
        size,
        thinning: 0.58,
        // Higher smoothing rounds the corners hand tremor puts in; lower
        // streamline keeps the line under the nib instead of lagging behind
        // it. Streamline is the setting that makes ink feel sluggish.
        smoothing: 0.62,
        streamline: 0.28,
        // Never simulate: the nib dynamics already supply a real per-point
        // value from pressure, speed and tilt.
        simulatePressure: false,
        capStart: true,
        capEnd: true,
        taperStart: size * 0.9,
        taperEnd: size * 1.4,
      };
  }
}

export function opacityFor(tool: InkTool): number {
  return tool === "highlighter" ? 0.4 : 1;
}

/** Highlighter must sit *under* ink so it reads as marking existing writing. */
export function isHighlighter(stroke: Pick<Stroke, "tool">): boolean {
  return stroke.tool === "highlighter";
}
