"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useMemo } from "react";
import type { Subject } from "@/lib/db";
import { stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import type { LibraryItem, Section, ViewMode } from "./logic";
import { NoteCard } from "./NoteCard";
import { SetCard } from "./SetCard";
import type { Mastery } from "./store";

/**
 * The note + set grid. Cards stagger in on mount and `layout` keeps them
 * gliding into place when a sort, filter or search changes the order;
 * `popLayout` lets removed cards fade out without a jump.
 */
export function ContentGrid({
  items,
  view,
  section,
  subjects,
  mastery,
  gridKey,
}: {
  items: LibraryItem[];
  view: ViewMode;
  section: Section;
  subjects: Subject[];
  mastery: Record<string, Mastery>;
  /** Changing this remounts the list so the stagger plays again. */
  gridKey: string;
}) {
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  return (
    <LayoutGroup id="library-grid">
      <motion.ul
        key={gridKey}
        role="list"
        aria-label="Notes and study sets"
        variants={stagger(0.035)}
        initial="hidden"
        animate="show"
        className={cn(
          "relative",
          view === "grid"
            ? "grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-4"
            : "flex flex-col gap-2",
        )}
      >
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            // Inside a subject the chip would be redundant; elsewhere it
            // tells you where the note lives.
            const showSubject =
              item.subjectId !== null &&
              !(section.kind === "subject" && section.id === item.subjectId);
            const subject = showSubject ? subjectById.get(item.subjectId!) : undefined;

            return item.kind === "note" ? (
              <NoteCard key={item.id} item={item} view={view} subject={subject} />
            ) : (
              <SetCard
                key={item.id}
                item={item}
                view={view}
                subject={subject}
                mastery={mastery[item.id]}
              />
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </LayoutGroup>
  );
}

/** Placeholder cards shown until the first IndexedDB read lands. */
export function GridSkeleton({ view }: { view: ViewMode }) {
  return (
    <div
      role="status"
      aria-label="Loading library"
      className={cn(
        view === "grid"
          ? "grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-4"
          : "flex flex-col gap-2",
      )}
    >
      {Array.from({ length: view === "grid" ? 8 : 6 }, (_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-2)]",
            view === "grid" ? "aspect-[4/3.6]" : "h-16",
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}
