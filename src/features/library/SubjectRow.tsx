"use client";

import type { DragControls } from "framer-motion";
import { ChevronRight, FolderPlus, GripVertical, MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Menu, useMenu } from "@/components/menu/Menu";
import { IconButton } from "@/components/ui";
import type { Subject } from "@/lib/db";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { createSubject, nudgeSubject, recolorSubject, renameSubject } from "./actions";
import { ColorPicker } from "./ColorPicker";
import { useLibrary } from "./store";

export interface SubjectRowProps {
  subject: Subject;
  depth: 0 | 1;
  selected: boolean;
  count: number;
  /** Top-level subjects with dividers get a disclosure chevron. */
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onSelect: () => void;
  /** Present on draggable (top-level) rows: the grip hands off to it. */
  dragControls?: DragControls;
  dividerListId?: string;
}

/**
 * One subject or divider in the sidebar. Double-click (or F2) renames it in
 * place, the colour dot opens the palette, Alt+Arrow moves it among siblings,
 * and the grip starts a drag reorder.
 */
export function SubjectRow({
  subject,
  depth,
  selected,
  count,
  expandable,
  expanded,
  onToggleExpand,
  onSelect,
  dragControls,
  dividerListId,
}: SubjectRowProps) {
  const editing = useLibrary((s) => s.editingSubjectId === subject.id);
  const setEditing = useLibrary((s) => s.setEditingSubjectId);
  const setDialog = useLibrary((s) => s.setDialog);

  const menu = useMenu();
  const [colorOpen, setColorOpen] = useState(false);
  const colorAnchor = useRef<HTMLButtonElement>(null);
  const [live, setLive] = useState("");

  const startRename = () => setEditing(subject.id);

  const nudge = async (dir: -1 | 1) => {
    const moved = await nudgeSubject(subject.id, dir);
    if (moved) setLive(`Moved ${subject.name} ${dir < 0 ? "up" : "down"}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "F2") {
      e.preventDefault();
      startRename();
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      void nudge(e.key === "ArrowUp" ? -1 : 1);
    } else if (expandable && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      if ((e.key === "ArrowRight") !== !!expanded) {
        e.preventDefault();
        onToggleExpand?.();
      }
    }
  };

  const onGripPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
    dragControls?.start(e);
  };

  const menuItems = [
    { id: "rename", label: "Rename", icon: <Pencil />, hint: "F2", onSelect: startRename },
    {
      id: "color",
      label: "Change colour",
      icon: <Palette />,
      onSelect: () => setColorOpen(true),
    },
    ...(depth === 0
      ? [
          {
            id: "divider",
            label: "Add divider",
            icon: <FolderPlus />,
            onSelect: () => void createSubject(subject.id),
          },
        ]
      : []),
    { id: "sep", separator: true as const },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 />,
      danger: true,
      onSelect: () => setDialog({ kind: "delete-subject", subject }),
    },
  ];

  return (
    <div
      className={cn(
        "group/row relative flex h-9 items-center gap-1 rounded-[8px] pr-1 transition-colors duration-100",
        depth === 1 ? "pl-2" : "pl-0.5",
        selected
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : "text-[var(--text)] hover:bg-[var(--surface-2)]",
      )}
    >
      {/* Drag grip — pointer-only affordance; keyboard users have Alt+Arrow. */}
      {dragControls ? (
        <span
          aria-hidden
          onPointerDown={onGripPointerDown}
          className={cn(
            "flex h-7 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded",
            "text-[var(--text-faint)] opacity-0 transition-opacity active:cursor-grabbing",
            "group-hover/row:opacity-100 group-focus-within/row:opacity-100",
          )}
        >
          <GripVertical className="h-4 w-4" />
        </span>
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}

      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${subject.name}` : `Expand ${subject.name}`}
          aria-expanded={expanded}
          aria-controls={dividerListId}
          onClick={onToggleExpand}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--text-faint)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={spring.snap}
            className="inline-flex"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden />
      )}

      <button
        ref={colorAnchor}
        type="button"
        aria-label={`Change colour of ${subject.name}`}
        aria-haspopup="dialog"
        aria-expanded={colorOpen}
        onClick={() => setColorOpen(true)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-3)]"
      >
        <span
          aria-hidden
          className={cn("block rounded-[3px]", depth === 0 ? "h-3.5 w-3.5" : "h-2.5 w-2.5 rounded-full")}
          style={{ background: subject.color }}
        />
      </button>

      {editing ? (
        <RenameField
          subject={subject}
          onDone={(name) => {
            setEditing(null);
            void renameSubject(subject.id, name);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={startRename}
          onKeyDown={onKeyDown}
          aria-current={selected ? "true" : undefined}
          title={`${subject.name} — double-click to rename`}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center gap-2 rounded-[6px] text-left text-[14px]",
            selected ? "font-bold" : "font-semibold",
          )}
        >
          <span className="truncate">{subject.name}</span>
        </button>
      )}

      {!editing && (
        <span
          className={cn(
            "shrink-0 text-[12px] font-semibold tabular-nums transition-opacity",
            selected ? "text-[var(--brand)]" : "text-[var(--text-faint)]",
            "group-hover/row:opacity-0 group-focus-within/row:opacity-0",
          )}
          aria-label={`${count} items`}
        >
          {count > 0 ? count : ""}
        </span>
      )}

      {!editing && (
        <IconButton
          size="sm"
          label={`Options for ${subject.name}`}
          {...menu.triggerProps}
          className={cn(
            "absolute right-1 opacity-0 transition-opacity",
            "group-hover/row:opacity-100 group-focus-within/row:opacity-100",
            menu.open && "opacity-100",
          )}
        >
          <MoreHorizontal />
        </IconButton>
      )}

      <Menu
        open={menu.open}
        onClose={menu.close}
        anchorRef={menu.anchorRef}
        items={menuItems}
        label={`Options for ${subject.name}`}
      />
      <ColorPicker
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        anchorRef={colorAnchor}
        value={subject.color}
        onChange={(color) => void recolorSubject(subject.id, color)}
        label={`Colour for ${subject.name}`}
      />
      <span className="sr-only" aria-live="polite">
        {live}
      </span>
    </div>
  );
}

function RenameField({
  subject,
  onDone,
  onCancel,
}: {
  subject: Subject;
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(subject.name);
  const committed = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onDone(value);
  };
  const cancel = () => {
    if (committed.current) return;
    committed.current = true;
    onCancel();
  };

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      aria-label={`Rename ${subject.name}`}
      maxLength={80}
      className={cn(
        "h-7 min-w-0 flex-1 rounded-[6px] border border-[var(--brand)] bg-[var(--surface)] px-1.5",
        "text-[14px] font-semibold text-[var(--text)] outline-none",
      )}
    />
  );
}
