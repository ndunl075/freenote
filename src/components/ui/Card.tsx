"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Notability's cards: soft 14px corners, hairline border, a gentle hover tint. */
export function Card({
  className,
  interactive,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-[var(--border-soft)] bg-[var(--surface)]",
        "shadow-[var(--shadow-sm)]",
        interactive &&
          "cursor-pointer transition-all duration-150 " +
            "hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...rest}
    />
  );
}
