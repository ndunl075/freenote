"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Eraser,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Lasso,
  Pen,
  Redo2,
  Shapes,
  Type,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { IconButton, Tooltip } from "@/components/ui";
import {
  ERASER_SIZES,
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_SIZES,
  INK_COLORS,
  PEN_SIZES,
  type ToolId,
} from "@/lib/ink";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "./store";

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: "pen", label: "Pen", icon: <Pen />, shortcut: "1" },
  { id: "highlighter", label: "Highlighter", icon: <Highlighter />, shortcut: "2" },
  { id: "eraser", label: "Eraser", icon: <Eraser />, shortcut: "3" },
  { id: "lasso", label: "Lasso", icon: <Lasso />, shortcut: "4" },
  { id: "text", label: "Text", icon: <Type />, shortcut: "5" },
  { id: "shape", label: "Shapes", icon: <Shapes />, shortcut: "6" },
  { id: "image", label: "Image", icon: <ImageIcon />, shortcut: "7" },
  { id: "hand", label: "Pan", icon: <Hand />, shortcut: "8" },
];

/**
 * Notability's ribbon: a single row of tools, with a tray that slides open
 * underneath carrying whatever options the active tool actually has. Colour
 * and size never appear for tools that don't use them.
 */
export function Toolbar({ onBack }: { onBack: () => void }) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const title = useEditor((s) => s.note?.title ?? "");
  const rename = useEditor((s) => s.rename);

  const [draftTitle, setDraftTitle] = useState<string | null>(null);

  const showsTray = tool === "pen" || tool === "highlighter" || tool === "eraser";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--chrome-border)] bg-[var(--chrome)]/95 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3">
        <Tooltip label="Back to library">
          <IconButton label="Back to library" onClick={onBack}>
            <ChevronLeft />
          </IconButton>
        </Tooltip>

        <input
          value={draftTitle ?? title}
          onChange={(e) => setDraftTitle(e.target.value)}
          onFocus={() => setDraftTitle(title)}
          onBlur={() => {
            if (draftTitle !== null && draftTitle !== title) void rename(draftTitle);
            setDraftTitle(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraftTitle(null);
              e.currentTarget.blur();
            }
          }}
          aria-label="Note title"
          className={cn(
            "min-w-0 max-w-[280px] flex-1 rounded-[6px] bg-transparent px-2 py-1",
            "text-[15px] font-bold outline-none",
            "hover:bg-[var(--surface-2)] focus:bg-[var(--surface)]",
          )}
        />

        <div className="mx-auto flex items-center gap-0.5 rounded-full bg-[var(--surface)] p-1 shadow-[var(--shadow-sm)]">
          {TOOLS.map((t) => (
            <Tooltip key={t.id} label={`${t.label}  ·  ${t.shortcut}`}>
              <button
                onClick={() => setTool(t.id)}
                aria-label={t.label}
                aria-pressed={tool === t.id}
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-full",
                  "transition-colors duration-150 [&>svg]:h-[18px] [&>svg]:w-[18px]",
                  tool === t.id
                    ? "text-[var(--brand-ink)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                {tool === t.id && (
                  <motion.span
                    layoutId="tool-pill"
                    transition={spring.snap}
                    className="absolute inset-0 rounded-full bg-[var(--brand)]"
                  />
                )}
                <span className="relative z-10 inline-flex">{t.icon}</span>
              </button>
            </Tooltip>
          ))}
        </div>

        <Tooltip label="Undo  ·  ⌘Z">
          <IconButton label="Undo" onClick={undo} disabled={!canUndo}>
            <Undo2 />
          </IconButton>
        </Tooltip>
        <Tooltip label="Redo  ·  ⇧⌘Z">
          <IconButton label="Redo" onClick={redo} disabled={!canRedo}>
            <Redo2 />
          </IconButton>
        </Tooltip>
      </div>

      <AnimatePresence initial={false}>
        {showsTray && (
          <motion.div
            key={tool}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.sheet}
            className="overflow-hidden border-t border-[var(--chrome-border)]"
          >
            <ToolTray tool={tool} />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function ToolTray({ tool }: { tool: ToolId }) {
  const color = useEditor((s) => s.color);
  const highlighterColor = useEditor((s) => s.highlighterColor);
  const size = useEditor((s) => s.size);
  const highlighterSize = useEditor((s) => s.highlighterSize);
  const eraserSize = useEditor((s) => s.eraserSize);
  const setColor = useEditor((s) => s.setColor);
  const setSize = useEditor((s) => s.setSize);
  const setEraserSize = useEditor((s) => s.setEraserSize);

  if (tool === "eraser") {
    return (
      <div className="flex items-center gap-4 px-4 py-2.5">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
          Eraser
        </span>
        <SizeRow sizes={ERASER_SIZES} active={eraserSize} onPick={setEraserSize} max={44} />
      </div>
    );
  }

  const isHl = tool === "highlighter";
  const colors = isHl ? HIGHLIGHTER_COLORS : INK_COLORS;
  const sizes = isHl ? HIGHLIGHTER_SIZES : PEN_SIZES;
  const activeColor = isHl ? highlighterColor : color;
  const activeSize = isHl ? highlighterSize : size;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            aria-label={`Colour ${c}`}
            aria-pressed={activeColor === c}
            onClick={() => setColor(c)}
            className="relative inline-flex h-7 w-7 items-center justify-center rounded-full"
          >
            {activeColor === c && (
              <motion.span
                layoutId={`swatch-${tool}`}
                transition={spring.snap}
                className="absolute inset-0 rounded-full ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--chrome)]"
              />
            )}
            <span
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ background: c }}
            />
          </button>
        ))}
        <label className="relative ml-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center">
          <span
            className="h-5 w-5 rounded-full border border-black/10"
            style={{
              background:
                "conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)",
            }}
          />
          <input
            type="color"
            aria-label="Custom colour"
            value={activeColor}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      <div className="h-6 w-px bg-[var(--chrome-border)]" />

      <SizeRow sizes={sizes} active={activeSize} onPick={setSize} max={isHl ? 34 : 8} />
    </div>
  );
}

function SizeRow({
  sizes,
  active,
  onPick,
  max,
}: {
  sizes: readonly number[];
  active: number;
  onPick: (n: number) => void;
  max: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {sizes.map((s) => (
        <button
          key={s}
          aria-label={`Size ${s}`}
          aria-pressed={active === s}
          onClick={() => onPick(s)}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            active === s ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-2)]",
          )}
        >
          <span
            className="rounded-full bg-[var(--text)] transition-transform"
            style={{
              // Scaled to a common ceiling so the dots read as relative widths.
              width: Math.max(4, (s / max) * 18),
              height: Math.max(4, (s / max) * 18),
            }}
          />
        </button>
      ))}
    </div>
  );
}
