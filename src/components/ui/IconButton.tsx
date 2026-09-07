"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  children: ReactNode;
}

const sizes = {
  sm: "h-7 w-7 [&>svg]:h-[15px] [&>svg]:w-[15px]",
  md: "h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]",
  lg: "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, size = "md", active, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full",
          "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
          active
            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
          sizes[size],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
