"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { stagger } from "@/lib/motion/springs";
import { rowIn } from "./motion";
import { cn } from "@/lib/utils/cn";
import { MODES } from "./modes";
import { routes } from "./routes";

/** The row of mode cards under a set's title: icon + label, lifts on hover. */
export function ModeTiles({ setId, className }: { setId: string; className?: string }) {
  return (
    <motion.nav
      aria-label="Study modes"
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}
    >
      {MODES.map((m) => (
        <motion.div key={m.id} variants={rowIn}>
          <Link
            href={routes.study(setId, m.id)}
            title={m.blurb}
            className={cn(
              "group flex h-[64px] items-center gap-3 rounded-[12px] border-2 border-[var(--border-soft)]",
              "bg-[var(--surface)] px-4 text-[16px] font-bold text-[var(--text)] shadow-[var(--shadow-sm)]",
              "transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
              "hover:-translate-y-[3px] hover:border-[var(--border)] hover:shadow-[var(--shadow-md)]",
              "active:translate-y-0",
            )}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-soft)] text-[var(--brand)] transition-transform duration-150 group-hover:scale-105">
              <m.Icon className="h-5 w-5" aria-hidden />
            </span>
            {m.label}
          </Link>
        </motion.div>
      ))}
    </motion.nav>
  );
}
