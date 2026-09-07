"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Quizlet's set/term cards: flat 8px surface, subtle border, lift on hover. */
export function Card({
  className,
  interactive,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)]",
        "shadow-[var(--shadow-sm)]",
        interactive &&
          "cursor-pointer transition-all duration-150 hover:-translate-y-[2px] " +
            "hover:border-[var(--border)] hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...rest}
    />
  );
}
