"use client";

import { useEffect, type RefObject } from "react";

/**
 * Move focus to `ref` when `open` flips true. Deferred one frame so the
 * element exists and the opening animation has started; keyboard users land
 * inside the dialog instead of on whatever was behind the overlay.
 */
export function useFocusOnOpen(open: boolean, ref: RefObject<HTMLElement | null>, select = false) {
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (select && el instanceof HTMLInputElement) el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open, ref, select]);
}
