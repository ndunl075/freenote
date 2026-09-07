import type { StudyMode } from "@/lib/db";

/**
 * Static export can't prerender unknown ids, so every study route carries
 * its id in the query string. `trailingSlash` is on, hence the `/?`.
 */
export const routes = {
  home: "/",
  sets: "/set/",
  set: (id: string) => `/set/?id=${encodeURIComponent(id)}`,
  study: (setId: string, mode: StudyMode) =>
    `/study/?set=${encodeURIComponent(setId)}&mode=${mode}`,
  create: "/create-set/",
  edit: (id: string) => `/create-set/?id=${encodeURIComponent(id)}`,
};

export const STUDY_MODES: StudyMode[] = ["flashcards", "learn", "test", "match", "blast"];

export function isStudyMode(value: string | null | undefined): value is StudyMode {
  return !!value && (STUDY_MODES as string[]).includes(value);
}
