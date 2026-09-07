"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, Trash2, X } from "lucide-react";
import { PAGE_WIDTH } from "@/lib/db";
import { isSelectionEmpty } from "@/lib/ink";
import { spring } from "@/lib/motion/springs";
import { useEditor } from "./store";

/**
 * The chrome that appears around a lasso selection: a dashed bounding box you
 * can drag, plus a floating action bar. Dragging moves in page coordinates so
 * the selection tracks the pointer exactly at any zoom level.
 */
export function SelectionOverlay({ pageId, width }: { pageId: string; width: number }) {
  const selection = useEditor((s) => s.selection);
  const selectionPageId = useEditor((s) => s.selectionPageId);
  const nudge = useEditor((s) => s.nudgeSelection);
  const remove = useEditor((s) => s.deleteSelection);
  const clear = useEditor((s) => s.clearSelection);

  const active = selectionPageId === pageId && !isSelectionEmpty(selection);
  const scale = width / PAGE_WIDTH;

  const [x0, y0, x1, y1] = selection.bounds;
  const boxWidth = (x1 - x0) * scale;
  const boxHeight = (y1 - y0) * scale;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={spring.snap}
          className="absolute"
          style={{
            left: x0 * scale - 6,
            top: y0 * scale - 6,
            width: boxWidth + 12,
            height: boxHeight + 12,
          }}
        >
          <div
            role="group"
            aria-label="Selection"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              let lastX = e.clientX;
              let lastY = e.clientY;

              const move = (ev: PointerEvent) => {
                const dx = (ev.clientX - lastX) / scale;
                const dy = (ev.clientY - lastY) / scale;
                lastX = ev.clientX;
                lastY = ev.clientY;
                nudge(dx, dy);
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            className="h-full w-full cursor-move rounded-[4px] border-2 border-dashed border-[var(--brand)] bg-[var(--brand)]/5"
          />

          <div className="absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#0a092d] px-2 py-1.5 shadow-[var(--shadow-lg)]">
            <ActionButton label="Duplicate" onClick={() => nudge(16, 16)}>
              <Copy className="h-4 w-4" />
            </ActionButton>
            <ActionButton label="Delete selection" onClick={remove}>
              <Trash2 className="h-4 w-4" />
            </ActionButton>
            <ActionButton label="Deselect" onClick={clear}>
              <X className="h-4 w-4" />
            </ActionButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  );
}
