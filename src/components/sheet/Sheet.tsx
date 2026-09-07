"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { overlayFade, spring, duration } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  side?: "left" | "right";
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Slide-over drawer for narrow screens. Traps Tab inside itself, closes on
 * Escape or overlay tap, and returns focus to wherever it was opened from.
 */
export function Sheet({ open, onClose, label, side = "left", children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const offscreen = side === "left" ? "-100%" : "100%";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            variants={overlayFade}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-[var(--overlay)]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ x: offscreen }}
            animate={{ x: 0, transition: spring.sheet }}
            exit={{ x: offscreen, transition: { duration: duration.normal } }}
            className={cn(
              "absolute inset-y-0 flex w-[min(320px,86vw)] flex-col bg-[var(--surface)]",
              "shadow-[var(--shadow-xl)]",
              side === "left" ? "left-0" : "right-0",
              className,
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
