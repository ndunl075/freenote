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
 * Quizlet's buttons sit on a hard 4px bottom shadow and physically compress
 * into it on press — translate down 4px, shadow to 0. That one detail carries
 * most of the brand's tactile feel, so it lives here rather than being
 * re-implemented per surface.
 */
const base =
  "relative inline-flex items-center justify-center gap-2 rounded-[8px] font-bold " +
  "select-none whitespace-nowrap transition-[transform,box-shadow,background-color] " +
  "duration-100 ease-[cubic-bezier(0.4,0,0.2,1)] " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "active:translate-y-[4px]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_0_0_var(--brand-active)] " +
    "hover:bg-[var(--brand-hover)] active:shadow-none",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border-2 border-[var(--border)] " +
    "shadow-[0_4px_0_0_var(--border)] hover:bg-[var(--surface-2)] active:shadow-none",
  ghost:
    "bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)] active:translate-y-0 " +
    "font-semibold",
  danger:
    "bg-[var(--incorrect)] text-white shadow-[0_4px_0_0_var(--incorrect-text)] " +
    "hover:brightness-105 active:shadow-none",
  star:
    "bg-[var(--star)] text-[#2b2200] shadow-[0_4px_0_0_#c79c00] " +
    "hover:brightness-105 active:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-[17px]",
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
