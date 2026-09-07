"use client";

import { motion } from "framer-motion";
import { FilePlus2, Inbox, Layers, Search, Star, Upload, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PaperPreview } from "@/components/paper/PaperPreview";
import { Button } from "@/components/ui";
import type { Subject } from "@/lib/db";
import { riseIn, stagger } from "@/lib/motion/springs";
import { sectionTitle, type Section } from "./logic";

export interface EmptyStateProps {
  section: Section;
  query: string;
  subjects: Subject[];
  /** True when the whole library is empty, not just this section. */
  libraryEmpty: boolean;
  onNewNote: () => void;
  onNewSet: () => void;
  onImport: () => void;
  onClearSearch: () => void;
}

/**
 * Empty states that say what would fill the space and offer the way to do
 * it. The first-run state is the one most people see, so it gets a proper
 * illustration and the full set of actions.
 */
export function EmptyState(props: EmptyStateProps) {
  const { section, query, subjects, libraryEmpty } = props;

  if (query.trim()) {
    return (
      <Frame
        icon={Search}
        title={`No matches for “${query.trim()}”`}
        body="Search looks at note and set titles (and set descriptions). Try a shorter word, or check a different subject."
        actions={
          <Button variant="secondary" size="sm" onClick={props.onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }

  if (libraryEmpty) {
    return (
      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-[520px] flex-col items-center px-4 pb-16 pt-10 text-center"
      >
        <motion.div variants={riseIn} className="relative mb-7 h-[132px] w-[220px]" aria-hidden>
          <PageCard rotate={-8} x={-46} y={14} paper="grid" />
          <PageCard rotate={6} x={44} y={10} paper="dotted" />
          <PageCard rotate={0} x={0} y={0} paper="lined-wide" front />
        </motion.div>
        <motion.h2 variants={riseIn} className="text-[26px] leading-tight">
          Your library is empty
        </motion.h2>
        <motion.p variants={riseIn} className="mt-2 text-[15px] leading-relaxed text-[var(--text-muted)]">
          Notes and study sets you create live right here, on this device. Nothing is uploaded
          anywhere — export a backup whenever you want a copy.
        </motion.p>
        <motion.div variants={riseIn} className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={props.onNewNote} leading={<FilePlus2 className="h-4 w-4" aria-hidden />}>
            New note
          </Button>
          <Button variant="secondary" onClick={props.onNewSet} leading={<Layers className="h-4 w-4" aria-hidden />}>
            New study set
          </Button>
          <Button variant="ghost" onClick={props.onImport} leading={<Upload className="h-4 w-4" aria-hidden />}>
            Import backup
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  switch (section.kind) {
    case "recents":
      return (
        <Frame
          icon={Inbox}
          title="Nothing recent yet"
          body="The last two dozen notes and sets you edit collect here, newest first."
        />
      );
    case "starred":
      return (
        <Frame
          icon={Star}
          title="No starred items"
          body="Open the ⋯ menu on any note or study set and choose Star to keep it within reach here."
        />
      );
    case "unfiled":
      return (
        <Frame
          icon={Inbox}
          title="Everything is filed"
          body="Notes and sets without a subject land here. Right now there aren't any — nice and tidy."
          actions={
            <Button variant="secondary" size="sm" onClick={props.onNewNote}>
              New unfiled note
            </Button>
          }
        />
      );
    case "subject": {
      const name = sectionTitle(section, subjects);
      return (
        <Frame
          icon={FilePlus2}
          title={`${name} is empty`}
          body={`Start a note here and it's filed under ${name} automatically, or move existing notes in with ⋯ → Move to.`}
          actions={
            <>
              <Button size="sm" onClick={props.onNewNote}>
                New note in {name}
              </Button>
              <Button variant="secondary" size="sm" onClick={props.onNewSet}>
                New study set
              </Button>
            </>
          }
        />
      );
    }
    case "all":
    default:
      return (
        <Frame
          icon={FilePlus2}
          title="Nothing here yet"
          body="Create a note or a study set to get going."
          actions={
            <Button size="sm" onClick={props.onNewNote}>
              New note
            </Button>
          }
        />
      );
  }
}

function Frame({
  icon: Icon,
  title,
  body,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      variants={riseIn}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-[440px] flex-col items-center px-4 pb-16 pt-14 text-center"
    >
      <span
        aria-hidden
        className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"
      >
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="text-[20px]">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">{body}</p>
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </motion.div>
  );
}

function PageCard({
  rotate,
  x,
  y,
  paper,
  front,
}: {
  rotate: number;
  x: number;
  y: number;
  paper: "grid" | "dotted" | "lined-wide";
  front?: boolean;
}) {
  return (
    <div
      className="absolute left-1/2 top-0 h-[120px] w-[92px] overflow-hidden rounded-[8px] border border-[var(--border-soft)]"
      style={{
        transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rotate}deg)`,
        boxShadow: front ? "var(--shadow-lg)" : "var(--shadow-md)",
      }}
    >
      <PaperPreview paper={paper} scale={0.9} />
    </div>
  );
}
