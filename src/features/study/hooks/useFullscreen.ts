"use client";

import { useCallback, useEffect, useState } from "react";

export function useFullscreen(): [boolean, () => void] {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return [active, toggle];
}
