"use client";

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import Link from "next/link";
import type { Term } from "@/lib/db";
import { stagger } from "@/lib/motion/springs";
import { rowIn } from "./motion";
import { cn } from "@/lib/utils/cn";
import { StarButton } from "./StarButton";

/** "Terms in this set" — term on the left, definition on the right, star at the end. */
export function TermList({
  terms,
  onToggleStar,
  editHref,
  className,
}: {
  terms: Term[];
  onToggleStar: (term: Term) => void;
  editHref?: string;
  className?: string;
}) {
  return (
    <motion.ul
      variants={stagger(0.025)}
      initial="hidden"
      animate="show"
      className={cn("flex flex-col gap-3", className)}
    >
      {terms.map((t, i) => (
        <motion.li
          key={t.id}
          variants={rowIn}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[8px] bg-[var(--surface)]",
            "px-5 py-4 shadow-[var(--shadow-sm)] md:grid-cols-[minmax(0,2fr)_1px_minmax(0,3fr)_auto] md:gap-6",
          )}
        >
          <p className="text-[16px] leading-snug text-[var(--text)] break-words">
            <span className="sr-only">Term {i + 1}: </span>
            {t.term || <span className="text-[var(--text-faint)]">(empty)</span>}
          </p>
          <span aria-hidden className="hidden h-full min-h-[28px] w-px bg-[var(--border-soft)] md:block" />
          <p className="col-span-1 text-[16px] leading-snug text-[var(--text)] break-words md:col-auto">
            <span className="sr-only">Definition: </span>
            {t.definition || <span className="text-[var(--text-faint)]">(empty)</span>}
          </p>
          <div className="row-span-2 flex items-center gap-1 md:row-span-1">
            <StarButton starred={t.starred} onToggle={() => onToggleStar(t)} size="sm" />
            {editHref && (
              <Link
                href={editHref}
                aria-label={`Edit ${t.term || "term"}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            )}
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
