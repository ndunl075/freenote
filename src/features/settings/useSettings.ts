"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui";
import { settings, type Settings } from "@/lib/db";

/**
 * The settings record, loaded once and updated optimistically. `null` until
 * the first read lands so the page can render a skeleton without guessing.
 */
export function useSettings() {
  const [value, setValue] = useState<Settings | null>(null);

  const reload = useCallback(async () => {
    const next = await settings.get();
    setValue(next);
  }, []);

  useEffect(() => {
    let alive = true;
    settings.get().then((s) => {
      if (alive) setValue(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setValue((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      await settings.update(patch);
    } catch {
      toast.error("Couldn't save that setting.");
      setValue(await settings.get());
    }
  }, []);

  return { settings: value, update, reload };
}
