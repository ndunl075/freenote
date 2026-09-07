"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { spring, duration } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the panel hangs off. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Which edge of the anchor the panel lines up with. */
  align?: "start" | "end";
  role?: "menu" | "dialog" | "listbox" | "radiogroup";
  label: string;
  className?: string;
  children: ReactNode;
  /** Fires once the panel is in the DOM — the hook for moving focus inside. */
  onOpened?: (panel: HTMLDivElement) => void;
}

const GAP = 6;
const MARGIN = 8;

/**
 * A floating panel positioned next to an anchor, rendered through a portal so
 * it is never clipped by an overflow container. Positioning is written
 * straight to the DOM in a layout effect (no state, no flash): measure the
 * anchor and the panel, flip upward if it would fall off the bottom, and
 * clamp inside the viewport horizontally.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  role = "dialog",
  label,
  className,
  children,
  onOpened,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - a.bottom - MARGIN;
    const flip = p.height > spaceBelow && a.top - MARGIN > spaceBelow;
    const top = flip ? Math.max(MARGIN, a.top - GAP - p.height) : a.bottom + GAP;

    let left = align === "end" ? a.right - p.width : a.left;
    left = Math.max(MARGIN, Math.min(vw - MARGIN - p.width, left));

    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.transformOrigin = `${align === "end" ? "right" : "left"} ${flip ? "bottom" : "top"}`;
  }, [open, anchorRef, align]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel && onOpened) onOpened(panel);

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onCloseRef.current();
    };
    // Capture phase + stopPropagation: Escape closes only this panel, not a
    // Sheet or Dialog that happens to be listening underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    // The panel is fixed-positioned against a snapshot of the anchor, so any
    // scroll or resize outside it invalidates the placement: close instead of
    // drifting.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, anchorRef, onOpened]);

  // Hand focus back to the anchor when the panel goes away. The panel is
  // still mounted while its exit animation plays, so "focus is inside the
  // panel" counts as lost too — otherwise it drops to <body> a beat later.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      const lost = !active || active === document.body || panelRef.current?.contains(active);
      if (lost) anchorRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open, anchorRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role={role}
          aria-label={label}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: spring.snap }}
          exit={{ opacity: 0, scale: 0.98, y: -2, transition: { duration: duration.fast } }}
          className={cn(
            "fixed z-[70] min-w-[200px] rounded-[12px] border border-[var(--border-soft)]",
            "bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)] outline-none",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
