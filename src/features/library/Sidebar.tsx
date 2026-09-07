"use client";

import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { Clock, Files, Inbox, Plus, Star } from "lucide-react";
import { useId, useMemo, type ReactNode } from "react";
import type { Subject } from "@/lib/db";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { createSubject, persistSubjectOrder } from "./actions";
import {
  countSections,
  sameSection,
  subjectTree,
  toItems,
  type Section,
  type SectionCounts,
  type SubjectNode,
} from "./logic";
import { useLibrary } from "./store";
import { SubjectRow } from "./SubjectRow";

const FIXED: { section: Section; label: string; icon: ReactNode; count: (c: SectionCounts) => number }[] = [
  { section: { kind: "all" }, label: "All Notes", icon: <Files />, count: (c) => c.all },
  { section: { kind: "recents" }, label: "Recents", icon: <Clock />, count: (c) => c.recents },
  { section: { kind: "starred" }, label: "Starred", icon: <Star />, count: (c) => c.starred },
  { section: { kind: "unfiled" }, label: "Unfiled", icon: <Inbox />, count: (c) => c.unfiled },
];

/**
 * Notability's left rail: the four fixed views, then subjects with their
 * dividers nested one level down. Rendered both as a static column and
 * inside the mobile sheet.
 */
export function Sidebar({ className }: { className?: string }) {
  const subjects = useLibrary((s) => s.subjects);
  const notes = useLibrary((s) => s.notes);
  const sets = useLibrary((s) => s.sets);
  const section = useLibrary((s) => s.section);
  const setSection = useLibrary((s) => s.setSection);
  const expanded = useLibrary((s) => s.expanded);
  const toggleExpanded = useLibrary((s) => s.toggleExpanded);
  const setSubjects = useLibrary((s) => s.setSubjects);

  const tree = useMemo(() => subjectTree(subjects), [subjects]);
  const roots = useMemo(() => tree.map((n) => n.subject), [tree]);
  const counts = useMemo(
    () => countSections(toItems(notes, sets), subjects),
    [notes, sets, subjects],
  );

  const onReorder = (next: Subject[]) => {
    const orderOf = new Map(next.map((s, i) => [s.id, i + 1]));
    setSubjects(
      subjects.map((s) => {
        const order = orderOf.get(s.id);
        return order === undefined || order === s.order ? s : { ...s, order };
      }),
    );
  };

  return (
    <nav aria-label="Library" className={cn("flex h-full flex-col", className)}>
      <ul role="list" className="flex flex-col gap-0.5 px-2 pt-3">
        {FIXED.map((item) => {
          const selected = sameSection(item.section, section);
          const n = item.count(counts);
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => setSection(item.section)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[14px] transition-colors duration-100",
                  "[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0",
                  selected
                    ? "bg-[var(--brand-soft)] font-bold text-[var(--brand)]"
                    : "font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] [&>svg]:text-[var(--text-muted)]",
                )}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {n > 0 && (
                  <span
                    className={cn(
                      "text-[12px] font-semibold tabular-nums",
                      selected ? "text-[var(--brand)]" : "text-[var(--text-faint)]",
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center justify-between px-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-faint)]">
          Subjects
        </h2>
      </div>

      <Reorder.Group
        as="ul"
        axis="y"
        values={roots}
        onReorder={onReorder}
        role="list"
        className="mt-1 flex flex-col gap-0.5 px-2"
      >
        {tree.map((node) => (
          <SubjectGroup
            key={node.subject.id}
            node={node}
            section={section}
            counts={counts}
            expanded={!!expanded[node.subject.id]}
            onToggleExpand={() => toggleExpanded(node.subject.id)}
            onSelect={setSection}
          />
        ))}
      </Reorder.Group>

      {tree.length === 0 && (
        <p className="px-4 pt-1 text-[13px] leading-relaxed text-[var(--text-faint)]">
          Subjects keep notes for a class together. Add dividers inside them for units or weeks.
        </p>
      )}

      <div className="mt-auto px-2 pb-3 pt-4">
        <button
          type="button"
          onClick={() => void createSubject(null)}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-[14px] font-bold",
            "text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]",
          )}
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden />
          New Subject
        </button>
      </div>
    </nav>
  );
}

function SubjectGroup({
  node,
  section,
  counts,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  node: SubjectNode;
  section: Section;
  counts: SectionCounts;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: (s: Section) => void;
}) {
  const controls = useDragControls();
  const listId = useId();
  const { subject, dividers } = node;
  const hasDividers = dividers.length > 0;

  return (
    <Reorder.Item
      value={subject}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => void persistSubjectOrder()}
      transition={spring.soft}
      whileDrag={{
        scale: 1.02,
        boxShadow: "var(--shadow-lg)",
        zIndex: 10,
        background: "var(--surface)",
      }}
      className="relative rounded-[8px]"
    >
      <SubjectRow
        subject={subject}
        depth={0}
        selected={sameSection(section, { kind: "subject", id: subject.id })}
        count={counts.bySubject[subject.id] ?? 0}
        expandable={hasDividers}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onSelect={() => onSelect({ kind: "subject", id: subject.id })}
        dragControls={controls}
        dividerListId={hasDividers ? listId : undefined}
      />
      <AnimatePresence initial={false}>
        {hasDividers && expanded && (
          <motion.ul
            id={listId}
            role="list"
            key="dividers"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: spring.snap }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
            className="ml-[26px] overflow-hidden border-l border-[var(--border-soft)] pl-1"
          >
            {dividers.map((d) => (
              <li key={d.id} className="mt-0.5">
                <SubjectRow
                  subject={d}
                  depth={1}
                  selected={sameSection(section, { kind: "subject", id: d.id })}
                  count={counts.bySubject[d.id] ?? 0}
                  onSelect={() => onSelect({ kind: "subject", id: d.id })}
                />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}
