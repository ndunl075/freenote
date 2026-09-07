"use client";

import { useEffect, useState } from "react";

/**
 * A ticking clock for timers. Re-renders on every animation frame while
 * `running`, then freezes at the last value.
 */
export function useNow(running: boolean, source: () => number = Date.now): number {
  const [now, setNow] = useState(() => source());

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const loop = () => {
      setNow(source());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, source]);

  return now;
}
