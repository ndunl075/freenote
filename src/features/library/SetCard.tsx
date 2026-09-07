"use client";

import { motion } from "framer-motion";
import { Layers, Star } from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";
import { Progress } from "@/components/ui";
import type { Subject } from "@/lib/db";
import { riseIn } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { pluralize, relativeTime } from "@/lib/utils/format";
import { ItemMenuButton } from "./ItemMenuButton";
import type { LibraryItem, ViewMode } from "./logic";
import type { Mastery } from "./store";

type SetItem = Extract<LibraryItem, { kind: "set" }>;

const EMPTY: Mastery = { total: 0, mastered: 0, learning: 0, notStarted: 0 };

export function SetCard({
  ref,
  item,
  view,
  mastery = EMPTY,
  subject,
}: {
  /** Forwarded to the <li> so AnimatePresence's popLayout can measure it. */
  ref?: Ref<HTMLLIElement>;
  item: SetItem;
  view: ViewMode;
  mastery?: Mastery;
  subject?: Subject;
}) {
  const { set } = item;
  const href = `/set?id=${encodeURIComponent(set.id)}`;
  const masteryLabel =
    mastery.total === 0
      ? "No terms yet"
      : mastery.mastered === mastery.total
        ? "All mastered"
        : `${mastery.mastered} of ${mastery.total} mastered`;

  if (view === "list") {
    return (
      <motion.li ref={ref} layout variants={riseIn} exit="exit" className="group relative">
        <Link
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)] p-2 pr-12",
            "transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
          )}
        >
          <span
            aria-hidden
            className="flex h-12 w-16 shrink-0 items-center justify-center rounded-[6px] bg-[var(--brand-soft)] text-[var(--brand)]"
          >
            <Layers className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[15px] font-bold">
              <span className="truncate">{set.title}</span>
              {item.starred && <Star aria-label="Starred" className="h-3.5 w-3.5 shrink-0 fill-[var(--star)] text-[var(--star)]" />}
            </span>
            <Meta set={set} subject={subject} mastery={mastery} />
          </span>
          <span className="hidden w-28 shrink-0 sm:block" aria-label={masteryLabel}>
            <Progress value={mastery.mastered} max={mastery.total} tone="correct" height={6} />
          </span>
        </Link>
        <ItemMenuButton item={item} className="absolute right-2 top-1/2 -translate-y-1/2" />
      </motion.li>
    );
  }

  return (
    <motion.li ref={ref} layout variants={riseIn} exit="exit" className="group relative">
      <Link
        href={href}
        className={cn(
          "block overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)]",
          "shadow-[var(--shadow-sm)] transition-[transform,box-shadow,border-color] duration-150",
          "hover:-translate-y-[2px] hover:border-[var(--border)] hover:shadow-[var(--shadow-md)]",
        )}
      >
        <span className="flex aspect-[4/3] w-full flex-col justify-between border-b border-[var(--border-soft)] bg-[var(--brand-soft)] p-3">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--surface)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">
            <Layers aria-hidden className="h-3.5 w-3.5" />
            Study set
          </span>
          <span className="text-[var(--brand)]">
            <span className="block text-[34px] font-semibold leading-none tabular-nums">{mastery.total}</span>
            <span className="text-[12px] font-bold uppercase tracking-wide opacity-80">
              {mastery.total === 1 ? "term" : "terms"}
            </span>
          </span>
        </span>
        <span className="block p-3">
          <span className="flex items-start gap-1.5">
            <span className="line-clamp-2 flex-1 text-[15px] font-bold leading-snug">{set.title}</span>
            {item.starred && (
              <Star aria-label="Starred" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-[var(--star)] text-[var(--star)]" />
            )}
          </span>
          <Meta set={set} subject={subject} mastery={mastery} />
          <span className="mt-2.5 block" aria-label={masteryLabel}>
            <Progress value={mastery.mastered} max={mastery.total} tone="correct" height={6} />
          </span>
        </span>
      </Link>
      <ItemMenuButton
        item={item}
        className={cn(
          "absolute right-2 top-2 opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      />
    </motion.li>
  );
}

function Meta({ set, subject, mastery }: { set: SetItem["set"]; subject?: Subject; mastery: Mastery }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium text-[var(--text-muted)]">
      <time dateTime={new Date(set.updatedAt).toISOString()} className="whitespace-nowrap">
        {relativeTime(set.updatedAt)}
      </time>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">{pluralize(mastery.total, "term")}</span>
      {mastery.mastered > 0 && (
        <>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap text-[var(--correct-text)]">{mastery.mastered} mastered</span>
        </>
      )}
      {subject && (
        <>
          <span aria-hidden>·</span>
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject.color }} />
            <span className="truncate">{subject.name}</span>
          </span>
        </>
      )}
    </span>
  );
}
