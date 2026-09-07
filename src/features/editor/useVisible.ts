"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element is near the viewport.
 *
 * Long notes are why this exists: a 50-page note would otherwise mount 50 pairs
 * of canvases, each with a device-pixel backing store. At 2x DPR one
 * letter-size page is roughly 1632x2112 — about 13MB per layer. Mounting only
 * what is on screen, plus a screen of margin either side, keeps that bounded no
 * matter how long the note gets.
 *
 * `initial` seeds the first render so the top of the note paints immediately
 * rather than flashing placeholders while the observer's first callback lands.
 * It also doubles as the fallback for browsers without IntersectionObserver:
 * with no observer to prune anything, whatever starts visible stays visible.
 */
export function useNearViewport<T extends HTMLElement>(
  initial = false,
  rootMargin = "150% 0px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, visible];
}
