"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, settings as settingsRepo, type Settings } from "@/lib/db";

export interface SettingsState {
  settings: Settings;
  /** False until IndexedDB has answered; defaults apply meanwhile. */
  loaded: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
}

/** App settings with defaults until IndexedDB answers. */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    settingsRepo
      .get()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      await settingsRepo.update(patch);
    } catch {
      /* best effort — the in-memory value still applies for this session */
    }
  }, []);

  return { settings, loaded, update };
}
