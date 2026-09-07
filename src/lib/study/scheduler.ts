import type { Progress } from "@/lib/db";

/**
 * SM-2-lite Leitner scheduler.
 *
 * Every term sits in a box 0..5. A correct answer moves it up (further into
 * the future), a wrong one drops it back to the start of the ladder. Learn
 * jumps more than one box at a time so a term can be mastered in a couple of
 * rounds rather than five — see `LEARN_STEPS`.
 */

export const MIN_BOX = 0;
export const MAX_BOX = 5;
/** Box at which a term counts as mastered. Matches `progress.summary` in the db layer. */
export const MASTERED_BOX = 5;
/** Learn switches a term from multiple choice to written once it reaches this box. */
export const WRITTEN_BOX = 2;

/** How far a correct answer moves a term in Learn, by question type. */
export const LEARN_STEPS = { choice: 2, written: 3 } as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Review interval per box. Box 0 is always due. */
export const BOX_INTERVALS_MS: readonly number[] = [0, 10 * MINUTE, HOUR, DAY, 3 * DAY, 7 * DAY];

export type Mastery = "not-started" | "learning" | "mastered";

const clampBox = (box: number) => Math.max(MIN_BOX, Math.min(MAX_BOX, Math.round(box)));

export function masteryOf(p: Progress): Mastery {
  if (p.box >= MASTERED_BOX) return "mastered";
  if (p.box > 0 || p.seen > 0) return "learning";
  return "not-started";
}

export function promote(p: Progress, now = Date.now(), steps = 1): Progress {
  const box = clampBox(p.box + Math.max(1, steps));
  return {
    ...p,
    box,
    streak: p.streak + 1,
    seen: p.seen + 1,
    correct: p.correct + 1,
    dueAt: now + BOX_INTERVALS_MS[box],
    lastSeenAt: now,
  };
}

/** A miss drops the term to box 1 (or keeps it at 0) and makes it due immediately. */
export function demote(p: Progress, now = Date.now()): Progress {
  return {
    ...p,
    box: p.box >= 2 ? 1 : 0,
    streak: 0,
    lapses: p.lapses + 1,
    seen: p.seen + 1,
    dueAt: now,
    lastSeenAt: now,
  };
}

export function isDue(p: Progress, now = Date.now()): boolean {
  return p.dueAt <= now;
}

export function isMastered(p: Progress): boolean {
  return p.box >= MASTERED_BOX;
}

export interface PickOptions {
  /** Term ids to skip — usually whatever was just shown. */
  exclude?: Iterable<string>;
  includeMastered?: boolean;
}

/**
 * Study priority: due before not-due, lower boxes first, least recently seen
 * first. Ties keep input order, so callers can pre-shuffle for variety.
 */
export function compareForStudy(a: Progress, b: Progress, now: number): number {
  const dueA = isDue(a, now) ? 0 : 1;
  const dueB = isDue(b, now) ? 0 : 1;
  if (dueA !== dueB) return dueA - dueB;
  if (a.box !== b.box) return a.box - b.box;
  return a.lastSeenAt - b.lastSeenAt;
}

export function orderForStudy(
  list: readonly Progress[],
  now = Date.now(),
  opts: PickOptions = {},
): Progress[] {
  const excluded = new Set(opts.exclude ?? []);
  return list
    .filter((p) => !excluded.has(p.termId) && (opts.includeMastered || !isMastered(p)))
    .sort((a, b) => compareForStudy(a, b, now));
}

/** The single best term to show next, or null when nothing is left to study. */
export function pickNext(
  list: readonly Progress[],
  now = Date.now(),
  opts: PickOptions = {},
): Progress | null {
  const ordered = orderForStudy(list, now, opts);
  if (ordered.length) return ordered[0];
  // Everything else is excluded — fall back to whatever is allowed at all.
  if (opts.exclude) {
    const relaxed = orderForStudy(list, now, { includeMastered: opts.includeMastered });
    return relaxed[0] ?? null;
  }
  return null;
}

export interface MasterySummary {
  total: number;
  notStarted: number;
  learning: number;
  mastered: number;
}

export function summarize(list: readonly Progress[]): MasterySummary {
  const out: MasterySummary = { total: list.length, notStarted: 0, learning: 0, mastered: 0 };
  for (const p of list) {
    const m = masteryOf(p);
    if (m === "mastered") out.mastered++;
    else if (m === "learning") out.learning++;
    else out.notStarted++;
  }
  return out;
}
