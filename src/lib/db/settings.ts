import { db } from "./database";
import { DEFAULT_SETTINGS, type Settings } from "./types";

export const settings = {
  async get(): Promise<Settings> {
    const stored = await db().settings.get("settings");
    // Merge rather than replace: a settings key added in a later release must
    // not read as undefined for someone upgrading.
    return { ...DEFAULT_SETTINGS, ...stored, id: "settings" };
  },

  async update(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await settings.get()), ...patch, id: "settings" as const };
    await db().settings.put(next);
    return next;
  },

  async reset(): Promise<Settings> {
    await db().settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  },
};
