"use client";

import { useId } from "react";
import type { PaperColor, PaperStyle } from "@/lib/db";
import { cn } from "@/lib/utils/cn";

export const PAPER_LABELS: Record<PaperStyle, string> = {
  blank: "Blank",
  "lined-narrow": "Narrow lines",
  "lined-wide": "Wide lines",
  grid: "Grid",
  dotted: "Dotted",
  cornell: "Cornell",
  music: "Music",
};

export const PAPER_COLOR_LABELS: Record<PaperColor, string> = {
  white: "White",
  cream: "Cream",
  yellow: "Yellow",
  gray: "Gray",
  black: "Black",
};

/**
 * Paper tints are derived from theme tokens with `color-mix`, so every tint
 * follows the light/dark switch without a second palette. "Black" stacks two
 * overlay layers over the paper token, which lands near-black in both themes.
 */
export function paperBackground(color: PaperColor): string {
  switch (color) {
    case "white":
      return "var(--paper)";
    case "cream":
      return "color-mix(in srgb, var(--paper) 84%, var(--star) 16%)";
    case "yellow":
      return "color-mix(in srgb, var(--paper) 58%, var(--star) 42%)";
    case "gray":
      return "color-mix(in srgb, var(--paper) 72%, var(--text-faint) 28%)";
    case "black":
      return "linear-gradient(var(--overlay), var(--overlay)), linear-gradient(var(--overlay), var(--overlay)), var(--paper)";
  }
}

/**
 * Draws the ruling of a page as an SVG pattern — the same thing the editor
 * renders behind ink, reduced to a thumbnail. Used wherever a note has no
 * snapshot yet and in the paper picker in Settings.
 */
export function PaperPreview({
  paper,
  color = "white",
  className,
  scale = 1,
}: {
  paper: PaperStyle;
  color?: PaperColor;
  className?: string;
  /** Multiplies the ruling spacing; keep at 1 for thumbnails, ~1.6 for pickers. */
  scale?: number;
}) {
  const id = useId();
  const pid = `paper-${id}`;
  const line = color === "black" ? "var(--border-strong)" : "var(--paper-line)";
  const margin = color === "black" ? "var(--incorrect)" : "var(--paper-margin)";

  const wide = 14 * scale;
  const narrow = 9 * scale;
  const cell = 10 * scale;

  let pattern: React.ReactNode = null;
  let extras: React.ReactNode = null;
  let size = wide;

  switch (paper) {
    case "blank":
      break;
    case "lined-wide":
    case "lined-narrow":
    case "cornell": {
      size = paper === "lined-narrow" ? narrow : wide;
      pattern = <line x1={0} y1={size - 0.5} x2={size} y2={size - 0.5} stroke={line} strokeWidth={1} />;
      if (paper === "cornell") {
        extras = (
          <>
            <line x1="30%" y1="0" x2="30%" y2="100%" stroke={margin} strokeWidth={1.5} />
            <rect x="0" y="0" width="100%" height={size * 1.5} fill={line} opacity={0.25} />
            <line x1="0" y1="82%" x2="100%" y2="82%" stroke={margin} strokeWidth={1.5} />
          </>
        );
      } else {
        extras = <line x1="14%" y1="0" x2="14%" y2="100%" stroke={margin} strokeWidth={1.2} />;
      }
      break;
    }
    case "grid":
      size = cell;
      pattern = (
        <path
          d={`M ${cell} 0 L 0 0 0 ${cell}`}
          fill="none"
          stroke={line}
          strokeWidth={0.8}
        />
      );
      break;
    case "dotted":
      size = cell;
      pattern = <circle cx={cell / 2} cy={cell / 2} r={0.9 * scale} fill={line} />;
      break;
    case "music": {
      const gap = 3.2 * scale;
      size = gap * 4 + 14 * scale;
      pattern = (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={0}
              y1={4 * scale + i * gap}
              x2={size}
              y2={4 * scale + i * gap}
              stroke={line}
              strokeWidth={0.8}
            />
          ))}
        </>
      );
      break;
    }
  }

  return (
    <div
      aria-hidden
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ background: paperBackground(color) }}
    >
      {pattern && (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id={pid} width={size} height={size} patternUnits="userSpaceOnUse">
              {pattern}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${pid})`} />
          {extras}
        </svg>
      )}
    </div>
  );
}
