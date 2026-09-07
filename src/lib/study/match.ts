import type { Term } from "@/lib/db";
import { sample, shuffle, type Rng } from "./random";

/**
 * Match: pair every term with its definition as fast as you can.
 *
 * Twelve tiles (six pairs) on a grid. Selecting two tiles either clears them
 * or flashes a mismatch and adds a time penalty. Time is derived from
 * `startedAt`/`finishedAt` so the reducer never needs a clock of its own.
 */

export const MATCH_PAIRS = 6;
/** Quizlet: "Avoid wrong matches, they add extra time!" */
export const MATCH_PENALTY_MS = 1000;

export interface MatchTile {
  id: string;
  termId: string;
  side: "term" | "definition";
  text: string;
}

export interface MatchState {
  tiles: MatchTile[];
  selectedId: string | null;
  matchedIds: string[];
  /** The two tiles of the last wrong guess, until `clearMismatch`. */
  mismatch: [string, string] | null;
  attempts: number;
  wrong: number;
  startedAt: number | null;
  finishedAt: number | null;
  penaltyMs: number;
}

const usable = (t: Term) => t.term.trim().length > 0 && t.definition.trim().length > 0;

export function createMatchGame(
  terms: readonly Term[],
  rng: Rng = Math.random,
  pairs = MATCH_PAIRS,
): MatchState {
  const chosen = sample(terms.filter(usable), pairs, rng);
  const tiles: MatchTile[] = [];
  for (const t of chosen) {
    tiles.push({ id: `${t.id}:term`, termId: t.id, side: "term", text: t.term });
    tiles.push({ id: `${t.id}:definition`, termId: t.id, side: "definition", text: t.definition });
  }
  return {
    tiles: shuffle(tiles, rng),
    selectedId: null,
    matchedIds: [],
    mismatch: null,
    attempts: 0,
    wrong: 0,
    startedAt: null,
    finishedAt: null,
    penaltyMs: 0,
  };
}

export function startMatch(state: MatchState, now = Date.now()): MatchState {
  if (state.startedAt !== null) return state;
  return { ...state, startedAt: now };
}

export function isPair(a: MatchTile, b: MatchTile): boolean {
  return a.id !== b.id && a.termId === b.termId && a.side !== b.side;
}

export function isMatchComplete(state: MatchState): boolean {
  return state.tiles.length > 0 && state.matchedIds.length === state.tiles.length;
}

export function isMatched(state: MatchState, tileId: string): boolean {
  return state.matchedIds.includes(tileId);
}

/** Tap (or drop onto) a tile. Starts the clock on the first selection. */
export function selectTile(state: MatchState, tileId: string, now = Date.now()): MatchState {
  if (state.finishedAt !== null) return state;
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile || isMatched(state, tileId)) return state;

  const started = state.startedAt === null ? { ...state, startedAt: now } : state;
  const base = { ...started, mismatch: null };

  if (base.selectedId === null) return { ...base, selectedId: tileId };
  if (base.selectedId === tileId) return { ...base, selectedId: null };

  const first = base.tiles.find((t) => t.id === base.selectedId)!;
  const attempts = base.attempts + 1;

  if (isPair(first, tile)) {
    const matchedIds = [...base.matchedIds, first.id, tile.id];
    const done = matchedIds.length === base.tiles.length;
    return {
      ...base,
      selectedId: null,
      matchedIds,
      attempts,
      finishedAt: done ? now : null,
    };
  }

  return {
    ...base,
    selectedId: null,
    attempts,
    wrong: base.wrong + 1,
    penaltyMs: base.penaltyMs + MATCH_PENALTY_MS,
    mismatch: [first.id, tile.id],
  };
}

export function clearMismatch(state: MatchState): MatchState {
  return state.mismatch ? { ...state, mismatch: null } : state;
}

/** Elapsed play time including penalties. Zero before the first tap. */
export function matchElapsed(state: MatchState, now = Date.now()): number {
  if (state.startedAt === null) return 0;
  const end = state.finishedAt ?? now;
  return Math.max(0, end - state.startedAt) + state.penaltyMs;
}

export function remainingTiles(state: MatchState): MatchTile[] {
  return state.tiles.filter((t) => !isMatched(state, t.id));
}
