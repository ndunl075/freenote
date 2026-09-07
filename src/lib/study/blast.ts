import type { Term } from "@/lib/db";
import { gradeAnswer, type Strictness } from "./grading";
import { createRng, nextSeed, type Rng } from "./random";

/**
 * Blast: definitions fall from the top of the screen; type the term before
 * one hits the bottom. Every five hits levels up (faster, more tiles), every
 * miss costs a life.
 *
 * All motion is expressed in normalised units — `y` runs 0 (top) to 1
 * (bottom) — so the UI can scale it to any viewport. Time is injected.
 */

export const BLAST_LIVES = 3;
export const BLAST_MAX_LEVEL = 10;
export const HITS_PER_LEVEL = 5;
/** Milliseconds for a tile to fall the full height at level 1. */
export const BASE_FALL_MS = 11_000;
export const BASE_SPAWN_MS = 3_400;
export const LANES = 4;
/** How long an exploded tile stays in `popped` so the UI can animate it. */
export const POP_TTL_MS = 700;

export interface BlastTile {
  id: string;
  termId: string;
  /** Falling text (the prompt). */
  text: string;
  /** What the learner must type. */
  answer: string;
  /** Horizontal lane centre, 0..1. */
  x: number;
  /** 0 = top, 1 = bottom. */
  y: number;
  /** Fraction of the height per millisecond. */
  speed: number;
  spawnedAt: number;
}

export interface BlastPop {
  id: string;
  x: number;
  y: number;
  at: number;
  points: number;
}

export type BlastStatus = "idle" | "playing" | "over";

export interface BlastState {
  terms: Term[];
  answerWith: "term" | "definition";
  status: BlastStatus;
  tiles: BlastTile[];
  popped: BlastPop[];
  score: number;
  lives: number;
  level: number;
  streak: number;
  bestStreak: number;
  hits: number;
  misses: number;
  lastTick: number;
  nextSpawnAt: number;
  /** termIds in the order they were last used; the tail is the most recent. */
  recent: string[];
  lastAnswer: { input: string; hit: boolean; at: number } | null;
  seed: number;
  counter: number;
}

export interface CreateBlastOptions {
  seed?: number;
  answerWith?: "term" | "definition";
}

const usable = (t: Term) => t.term.trim().length > 0 && t.definition.trim().length > 0;

export function speedForLevel(level: number): number {
  return 1 / (BASE_FALL_MS * Math.pow(0.86, level - 1));
}

export function spawnIntervalForLevel(level: number): number {
  return Math.max(1_300, BASE_SPAWN_MS * Math.pow(0.9, level - 1));
}

export function maxConcurrentForLevel(level: number): number {
  return Math.min(5, 2 + Math.floor(level / 2));
}

export function levelForHits(hits: number): number {
  return Math.min(BLAST_MAX_LEVEL, 1 + Math.floor(hits / HITS_PER_LEVEL));
}

export function pointsFor(level: number, streak: number): number {
  return 100 * level + 10 * Math.min(streak, 10);
}

export function createBlastState(terms: readonly Term[], opts: CreateBlastOptions = {}): BlastState {
  return {
    terms: terms.filter(usable),
    answerWith: opts.answerWith ?? "term",
    status: "idle",
    tiles: [],
    popped: [],
    score: 0,
    lives: BLAST_LIVES,
    level: 1,
    streak: 0,
    bestStreak: 0,
    hits: 0,
    misses: 0,
    lastTick: 0,
    nextSpawnAt: 0,
    recent: [],
    lastAnswer: null,
    seed: opts.seed ?? Math.floor(Math.random() * 0x7fffffff),
    counter: 0,
  };
}

function chooseTerm(state: BlastState, rng: Rng): Term | null {
  const falling = new Set(state.tiles.map((t) => t.termId));
  const candidates = state.terms.filter((t) => !falling.has(t.id));
  if (!candidates.length) return null;
  // Prefer terms not seen recently; among those, pick at random.
  const recentSet = new Set(state.recent.slice(-Math.floor(state.terms.length / 2)));
  const fresh = candidates.filter((t) => !recentSet.has(t.id));
  const pool = fresh.length ? fresh : candidates;
  return pool[Math.floor(rng() * pool.length)];
}

function spawn(state: BlastState, now: number, rng: Rng): BlastState {
  const term = chooseTerm(state, rng);
  if (!term) return state;

  const last = state.tiles[state.tiles.length - 1];
  const usedLanes = new Set(state.tiles.map((t) => Math.round(t.x * LANES - 0.5)));
  const free: number[] = [];
  for (let i = 0; i < LANES; i++) if (!usedLanes.has(i)) free.push(i);
  const laneChoices = free.length ? free : Array.from({ length: LANES }, (_, i) => i);
  let lane = laneChoices[Math.floor(rng() * laneChoices.length)];
  if (last && laneChoices.length > 1 && Math.abs((lane + 0.5) / LANES - last.x) < 0.01) {
    lane = laneChoices[(laneChoices.indexOf(lane) + 1) % laneChoices.length];
  }

  const tile: BlastTile = {
    id: `b${state.counter + 1}`,
    termId: term.id,
    text: state.answerWith === "term" ? term.definition : term.term,
    answer: state.answerWith === "term" ? term.term : term.definition,
    x: (lane + 0.5) / LANES,
    y: 0,
    speed: speedForLevel(state.level),
    spawnedAt: now,
  };
  return {
    ...state,
    tiles: [...state.tiles, tile],
    counter: state.counter + 1,
    recent: [...state.recent, term.id].slice(-state.terms.length),
  };
}

export function startBlast(state: BlastState, now = Date.now()): BlastState {
  if (!state.terms.length) return { ...state, status: "over" };
  const rng = createRng(state.seed);
  const fresh: BlastState = {
    ...createBlastState(state.terms, { seed: state.seed, answerWith: state.answerWith }),
    status: "playing",
    lastTick: now,
  };
  const spawned = spawn(fresh, now, rng);
  return { ...spawned, nextSpawnAt: now + spawnIntervalForLevel(1), seed: nextSeed(rng) };
}

/** Advance the simulation to `now`. Call from a requestAnimationFrame loop. */
export function tickBlast(state: BlastState, now = Date.now()): BlastState {
  if (state.status !== "playing") return state;
  const dt = Math.max(0, Math.min(250, now - state.lastTick));

  const moved = state.tiles.map((t) => ({ ...t, y: t.y + t.speed * dt }));
  const landed = moved.filter((t) => t.y >= 1);
  const tiles = moved.filter((t) => t.y < 1);

  let next: BlastState = {
    ...state,
    tiles,
    lastTick: now,
    popped: state.popped.filter((p) => now - p.at < POP_TTL_MS),
  };

  if (landed.length) {
    const lives = Math.max(0, state.lives - landed.length);
    next = { ...next, lives, misses: state.misses + landed.length, streak: 0 };
    if (lives === 0) return { ...next, status: "over", tiles: [] };
  }

  if (now >= next.nextSpawnAt && next.tiles.length < maxConcurrentForLevel(next.level)) {
    const rng = createRng(next.seed);
    next = spawn(next, now, rng);
    next = { ...next, nextSpawnAt: now + spawnIntervalForLevel(next.level), seed: nextSeed(rng) };
  }
  return next;
}

/** Submit typed text. Clears the most urgent matching tile, if any. */
export function answerBlast(
  state: BlastState,
  input: string,
  now = Date.now(),
  strictness: Strictness = "lenient",
): BlastState {
  if (state.status !== "playing") return state;
  if (!input.trim()) return state;

  const byUrgency = state.tiles.slice().sort((a, b) => b.y - a.y);
  const hit = byUrgency.find((t) => gradeAnswer(input, t.answer, strictness).correct);
  if (!hit) {
    return { ...state, streak: 0, lastAnswer: { input, hit: false, at: now } };
  }

  const streak = state.streak + 1;
  const points = pointsFor(state.level, streak);
  const hits = state.hits + 1;
  return {
    ...state,
    tiles: state.tiles.filter((t) => t.id !== hit.id),
    popped: [...state.popped, { id: hit.id, x: hit.x, y: hit.y, at: now, points }],
    score: state.score + points,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    hits,
    level: levelForHits(hits),
    lastAnswer: { input, hit: true, at: now },
  };
}

export function isBlastOver(state: BlastState): boolean {
  return state.status === "over";
}
