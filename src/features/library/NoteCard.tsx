"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";
import { PaperPreview, PAPER_LABELS } from "@/components/paper/PaperPreview";
import type { Subject } from "@/lib/db";
import { riseIn } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { pluralize, relativeTime } from "@/lib/utils/format";
import { ItemMenuButton } from "./ItemMenuButton";
import type { LibraryItem, ViewMode } from "./logic";

type NoteItem = Extract<LibraryItem, { kind: "note" }>;

export function NoteCard({
  ref,
  item,
  view,
  subject,
}: {
  /** Forwarded to the <li> so AnimatePresence's popLayout can measure it. */
  ref?: Ref<HTMLLIElement>;
  item: NoteItem;
  view: ViewMode;
  /** The subject the note is filed under, when worth showing. */
  subject?: Subject;
}) {
  const { note } = item;
  const href = `/note?id=${encodeURIComponent(note.id)}`;
  const pages = pluralize(note.pageIds.length, "page");

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
          <Thumb note={note} className="h-12 w-16 shrink-0 rounded-[6px]" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[15px] font-bold">
              <span className="truncate">{note.title}</span>
              {note.starred && <Star aria-label="Starred" className="h-3.5 w-3.5 shrink-0 fill-[var(--star)] text-[var(--star)]" />}
            </span>
            <Meta note={note} subject={subject} pages={pages} />
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
        <Thumb note={note} className="aspect-[4/3] w-full border-b border-[var(--border-soft)]" />
        <span className="block p-3">
          <span className="flex items-start gap-1.5">
            <span className="line-clamp-2 flex-1 text-[15px] font-bold leading-snug">{note.title}</span>
            {note.starred && (
              <Star aria-label="Starred" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-[var(--star)] text-[var(--star)]" />
            )}
          </span>
          <Meta note={note} subject={subject} pages={pages} />
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

function Thumb({ note, className }: { note: NoteItem["note"]; className?: string }) {
  if (note.thumbnail) {
    return (
      <div className={cn("overflow-hidden bg-[var(--paper)]", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from IndexedDB, never a remote asset */}
        <img src={note.thumbnail} alt="" className="h-full w-full object-cover object-top" />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden", className)} title={PAPER_LABELS[note.paper]}>
      <PaperPreview paper={note.paper} color={note.paperColor} />
      <span
        className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-muted)]"
        style={{ background: "color-mix(in srgb, var(--surface) 82%, transparent)" }}
      >
        {PAPER_LABELS[note.paper]}
      </span>
    </div>
  );
}

function Meta({ note, subject, pages }: { note: NoteItem["note"]; subject?: Subject; pages: string }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium text-[var(--text-muted)]">
      <time dateTime={new Date(note.updatedAt).toISOString()} className="whitespace-nowrap">
        {relativeTime(note.updatedAt)}
      </time>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">{pages}</span>
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
