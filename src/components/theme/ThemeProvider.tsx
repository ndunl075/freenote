"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "freenote.theme";

interface ThemeStore {
  choice: ThemeChoice;
  set: (c: ThemeChoice) => void;
}

export const useTheme = create<ThemeStore>((set) => ({
  choice: "system",
  set: (choice) => {
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* private mode — theme just won't persist */
    }
    apply(choice);
    set({ choice });
  },
}));

function apply(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Reads the stored choice on mount and keeps `system` in sync with the OS.
 * The pre-paint application happens in `themeScript` below, so this never
 * causes a flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setChoice = useTheme.setState;

  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      stored = (localStorage.getItem(KEY) as ThemeChoice | null) ?? "system";
    } catch {
      /* ignore */
    }
    setChoice({ choice: stored });
    apply(stored);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useTheme.getState().choice === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setChoice]);

  return <>{children}</>;
}

/** Runs before first paint to prevent a light-mode flash on dark systems. */
export const themeScript = `
(function(){
  try {
    var c = localStorage.getItem('${KEY}') || 'system';
    var d = c === 'dark' || (c === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (d) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
