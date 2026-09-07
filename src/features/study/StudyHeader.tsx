"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { StudyMode } from "@/lib/db";
import { cn } from "@/lib/utils/cn";
import { ModeMenu } from "./ModeMenu";
import { routes } from "./routes";

export interface StudyHeaderProps {
  mode: StudyMode;
  setId: string;
  title: string;
  /** Replaces the title in the centre — progress counters, timers. */
  center?: ReactNode;
  /** Extra controls placed before the close button. */
  right?: ReactNode;
  className?: string;
}

/**
 * The bar every study mode sits under: mode switcher on the left, set title
 * (or a counter) in the middle, options and a close button on the right.
 */
export function StudyHeader({ mode, setId, title, center, right, className }: StudyHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 md:px-6",
        "bg-[var(--bg-subtle)]/95 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-start">
        <ModeMenu current={mode} setId={setId} />
      </div>
      <div className="min-w-0 max-w-[48vw] text-center">
        {center ?? (
          <p className="truncate text-[15px] font-bold text-[var(--text)]" title={title}>
            {title}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        {right}
        <Link
          href={routes.set(setId)}
          aria-label="Close and go back to the set"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full",
            "text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
          )}
        >
          <X className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}

/** Full-height study surface: the soft grey ground every mode sits on. */
export function StudyScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-[var(--bg-subtle)] text-[var(--text)]", className)}>
      {children}
    </div>
  );
}
