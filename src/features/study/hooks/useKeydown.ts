"use client";

import { useEffect, useRef } from "react";

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (EDITABLE.has(el.tagName)) return true;
  return el.isContentEditable === true;
}

/**
 * Window-level keyboard shortcuts. Skips events fired from text fields unless
 * `inInputs` is set, so a mode's shortcuts never fight the written-answer box.
 */
export function useKeydown(
  handler: (e: KeyboardEvent) => void,
  opts: { enabled?: boolean; inInputs?: boolean } = {},
) {
  const ref = useRef(handler);
  const { enabled = true, inInputs = false } = opts;

  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!inInputs && isTypingTarget(e.target)) return;
      ref.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, inInputs]);
}
