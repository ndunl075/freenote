"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StudyMode } from "@/lib/db";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { MODES, modeMeta } from "./modes";
import { routes } from "./routes";

/** The "Flashcards ▾" pill in a mode's header — a dropdown that jumps between modes. */
export function ModeMenu({ current, setId }: { current: StudyMode; setId: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);
  const meta = modeMeta(current);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) items.current[MODES.findIndex((m) => m.id === current)]?.focus();
  }, [open, current]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const idx = items.current.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const next = (idx + delta + MODES.length) % MODES.length;
      items.current[next]?.focus();
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-[8px] px-3 text-[15px] font-bold",
          "text-[var(--text)] transition-colors hover:bg-[var(--surface-3)]",
        )}
      >
        <meta.Icon className="h-5 w-5 text-[var(--brand)]" aria-hidden />
        <span>{meta.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-[var(--text-muted)] transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Study modes"
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snap }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            className={cn(
              "absolute left-0 top-full z-40 mt-2 w-56 rounded-[12px] border border-[var(--border-soft)]",
              "bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]",
            )}
          >
            {MODES.map((m, i) => {
              const active = m.id === current;
              return (
                <Link
                  key={m.id}
                  role="menuitem"
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  href={routes.study(setId, m.id)}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[15px] font-semibold",
                    "outline-none transition-colors focus-visible:bg-[var(--surface-2)]",
                    active ? "text-[var(--brand)]" : "text-[var(--text)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="mode-menu-active"
                      transition={spring.snap}
                      className="absolute inset-0 -z-10 rounded-[8px] bg-[var(--brand-soft)]"
                    />
                  )}
                  <m.Icon className="h-5 w-5" aria-hidden />
                  <span className="flex-1">{m.label}</span>
                  {active && <Check className="h-4 w-4" aria-hidden />}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
