"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { StarButton } from "../StarButton";

/** Big text on short cards, smaller on long definitions. */
export function cardTextSize(text: string): string {
  const n = text.trim().length;
  if (n <= 40) return "text-[28px] md:text-[36px]";
  if (n <= 120) return "text-[22px] md:text-[28px]";
  if (n <= 300) return "text-[18px] md:text-[22px]";
  return "text-[16px] md:text-[18px]";
}

export interface FlipCardProps {
  front: string;
  back: string;
  frontLabel: string;
  backLabel: string;
  flipped: boolean;
  onFlip: () => void;
  starred?: boolean;
  onToggleStar?: () => void;
  /** Rendered inside the front face, bottom-left — hints, shortcuts. */
  corner?: ReactNode;
  className?: string;
}

/**
 * The 3D flashcard. Both faces are stacked with `preserve-3d`; the wrapper
 * rotates 180° on the Y axis and `backface-hidden` hides whichever side is
 * facing away. Click, tap, Space or Enter flips.
 */
export function FlipCard({
  front,
  back,
  frontLabel,
  backLabel,
  flipped,
  onFlip,
  starred,
  onToggleStar,
  corner,
  className,
}: FlipCardProps) {
  const reduce = useReducedMotion();

  return (
    <div className={cn("relative h-full w-full [perspective:1600px]", className)}>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`${flipped ? backLabel : frontLabel}: ${flipped ? back : front}. Press Space to flip.`}
        aria-pressed={flipped}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onFlip();
          }
        }}
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : spring.card}
        className="preserve-3d relative h-full w-full cursor-pointer select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-subtle)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        <Face label={frontLabel} text={front} starred={starred} onToggleStar={onToggleStar} corner={corner} />
        <Face label={backLabel} text={back} starred={starred} onToggleStar={onToggleStar} back />
      </motion.div>
    </div>
  );
}

function Face({
  label,
  text,
  back,
  starred,
  onToggleStar,
  corner,
}: {
  label: string;
  text: string;
  back?: boolean;
  starred?: boolean;
  onToggleStar?: () => void;
  corner?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "backface-hidden absolute inset-0 flex flex-col rounded-[16px] bg-[var(--surface)] shadow-[var(--shadow-md)]",
        "border border-[var(--border-soft)]",
      )}
      style={{ transform: back ? "rotateY(180deg)" : undefined }}
      aria-hidden={back}
    >
      <div className="flex items-center justify-between px-4 pt-3 md:px-6 md:pt-4">
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">{label}</span>
        {onToggleStar && <StarButton starred={!!starred} onToggle={onToggleStar} size="sm" />}
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-6 pb-8 md:px-14">
        <p
          className={cn(
            "max-h-full overflow-y-auto whitespace-pre-wrap break-words text-center font-medium leading-snug",
            cardTextSize(text),
          )}
        >
          {text || <span className="text-[var(--text-faint)]">(empty)</span>}
        </p>
      </div>
      {corner && <div className="absolute bottom-3 left-4 md:bottom-4 md:left-6">{corner}</div>}
    </div>
  );
}
