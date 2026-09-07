"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "star";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/**
 * Notability's buttons are quiet: a soft-cornered fill that dims and settles
 * very slightly under the finger. No hard offset shadow, no bounce — the
 * feedback is a tint change, the way iOS controls behave.
 */
const base =
  "relative inline-flex items-center justify-center gap-1.5 rounded-[9px] font-semibold " +
  "select-none whitespace-nowrap transition-[transform,background-color,border-color,opacity] " +
  "duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "active:scale-[0.975]";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]",
  secondary:
    "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] " +
    "hover:bg-[var(--surface-3)]",
  ghost: "bg-transparent text-[var(--brand)] hover:bg-[var(--surface-2)]",
  danger: "bg-[var(--incorrect)] text-white hover:brightness-95",
  star: "bg-[var(--star)] text-[#3a2c00] hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-9 px-3.5 text-[13.5px]",
  lg: "h-10 px-5 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, leading, trailing, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
});
