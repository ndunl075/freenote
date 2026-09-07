"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** The yellow star on every term row and flashcard. */
export function StarButton({
  starred,
  onToggle,
  size = "md",
  className,
}: {
  starred: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? "Unstar this term" : "Star this term"}
      title={starred ? "Unstar" : "Star"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={reduce ? undefined : { scale: 0.85 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        starred
          ? "text-[var(--star)] hover:bg-[var(--star-bg)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
        className,
      )}
    >
      <motion.span
        key={String(starred)}
        initial={reduce ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        className="inline-flex"
      >
        <Star
          className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}
          fill={starred ? "currentColor" : "none"}
          strokeWidth={2}
        />
      </motion.span>
    </motion.button>
  );
}
