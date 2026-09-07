import type { Progress, Term } from "@/lib/db";
import { buildChoices } from "./distractors";
import { gradeAnswer, sameAnswer, type Strictness } from "./grading";
import { createRng, nextSeed, shuffle, type Rng } from "./random";
import {
  demote,
  isMastered,
  LEARN_STEPS,
  orderForStudy,
  promote,
  summarize,
  WRITTEN_BOX,
  type MasterySummary,
} from "./scheduler";

/**
 * Learn mode.
 *
 * Rounds of seven. A term starts as multiple choice and graduates to a
 * written question once it has been boxed up; a miss drops it back and asks
 * it again before the round ends. The reducer is pure — the UI owns timing
 * (auto-advance on a correct answer) and persistence (`dirty` lists the
 * progress records that changed since the last flush).
 */

export const ROUND_SIZE = 7;
export const CHOICE_COUNT = 4;
/** How many times a missed term is re-asked within the same round. */
export const MAX_RETRIES_PER_ROUND = 1;

export type AnswerWith = "term" | "definition";
export type LearnQuestionKind = "choice" | "written";

export interface LearnQuestion {
  id: string;
  termId: string;
  kind: LearnQuestionKind;
  /** Which side of the card is shown as the prompt. */
  promptSide: "term" | "definition";
  prompt: string;
  answer: string;
  /** Shuffled choices including the answer; empty for written questions. */
  options: string[];
}

export interface LearnFeedback {
  question: LearnQuestion;
  input: string;
  correct: boolean;
  closeButTypo: boolean;
  skipped: boolean;
  /** The learner overrode a written miss with "I was right". */
  overridden: boolean;
  /** Progress before grading, so an override can re-grade from the same base. */
  before: Progress;
  /** The miss appended a retry question to the round. */
  requeued: boolean;
}

export interface LearnAttempt {
  termId: string;
  kind: LearnQuestionKind;
  correct: boolean;
}

export type LearnPhase = "question" | "feedback" | "round-summary" | "complete";

export interface LearnSettings {
  roundSize: number;
  answerWith: AnswerWith;
  strictness: Strictness;
}

export interface LearnState {
  terms: Term[];
  progress: Record<string, Progress>;
  settings: LearnSettings;
  /** 1-based round number. */
  round: number;
  queue: LearnQuestion[];
  index: number;
  phase: LearnPhase;
  feedback: LearnFeedback | null;
  attempts: LearnAttempt[];
  retries: Record<string, number>;
  /** Term ids whose progress changed since the UI last persisted. */
  dirty: string[];
  seed: number;
}

export type LearnAction =
  | { type: "answer"; input: string; now?: number }
  | { type: "skip"; now?: number }
  | { type: "override"; now?: number }
  | { type: "continue" }
  | { type: "next-round"; now?: number }
  | { type: "restart"; now?: number }
  | { type: "reset"; now?: number }
  | { type: "flushed"; termIds: string[] }
  | { type: "set-answer-with"; answerWith: AnswerWith; now?: number };

export interface CreateLearnOptions extends Partial<LearnSettings> {
  seed?: number;
  now?: number;
}

const blankProgress = (termId: string, setId: string): Progress => ({
  termId,
  setId,
  box: 0,
  streak: 0,
  lapses: 0,
  seen: 0,
  correct: 0,
  dueAt: 0,
  lastSeenAt: 0,
  writtenCorrect: 0,
  choiceCorrect: 0,
});

const studyable = (t: Term) => t.term.trim().length > 0 || t.definition.trim().length > 0;

export function createLearnState(
  terms: readonly Term[],
  progress: Iterable<Progress> = [],
  opts: CreateLearnOptions = {},
): LearnState {
  const usable = terms.filter(studyable);
  const known = new Map<string, Progress>();
  for (const p of progress) known.set(p.termId, p);
  const map: Record<string, Progress> = {};
  for (const t of usable) map[t.id] = known.get(t.id) ?? blankProgress(t.id, t.setId);

  const base: LearnState = {
    terms: usable,
    progress: map,
    settings: {
      roundSize: opts.roundSize ?? ROUND_SIZE,
      answerWith: opts.answerWith ?? "term",
      strictness: opts.strictness ?? "lenient",
    },
    round: 1,
    queue: [],
    index: 0,
    phase: "question",
    feedback: null,
    attempts: [],
    retries: {},
    dirty: [],
    seed: opts.seed ?? Math.floor(Math.random() * 0x7fffffff),
  };
  return buildRound(base, opts.now ?? Date.now());
}

function makeQuestion(
  terms: readonly Term[],
  term: Term,
  box: number,
  settings: LearnSettings,
  rng: Rng,
  id: string,
): LearnQuestion {
  const answerSide = settings.answerWith;
  const promptSide = answerSide === "term" ? "definition" : "term";
  const prompt = promptSide === "term" ? term.term : term.definition;
  const answer = answerSide === "term" ? term.term : term.definition;
  const pool = terms
    .filter((t) => t.id !== term.id)
    .map((t) => (answerSide === "term" ? t.term : t.definition))
    .filter((s) => s.trim().length > 0);

  const kind: LearnQuestionKind = box >= WRITTEN_BOX || pool.length === 0 ? "written" : "choice";
  return {
    id,
    termId: term.id,
    kind,
    promptSide,
    prompt,
    answer,
    options: kind === "choice" ? buildChoices(answer, pool, CHOICE_COUNT, rng) : [],
  };
}

function buildRound(state: LearnState, now: number): LearnState {
  const rng = createRng(state.seed);
  const list = shuffle(
    state.terms.map((t) => state.progress[t.id]),
    rng,
  );
  const picked = orderForStudy(list, now).slice(0, state.settings.roundSize);
  const byId = new Map(state.terms.map((t) => [t.id, t]));
  const queue = picked.map((p, i) =>
    makeQuestion(state.terms, byId.get(p.termId)!, p.box, state.settings, rng, `r${state.round}-q${i}`),
  );
  return {
    ...state,
    queue,
    index: 0,
    phase: queue.length ? "question" : "complete",
    feedback: null,
    attempts: [],
    retries: {},
    seed: nextSeed(rng),
  };
}

function addDirty(dirty: string[], termId: string): string[] {
  return dirty.includes(termId) ? dirty : [...dirty, termId];
}

function grade(state: LearnState, input: string, now: number, skipped: boolean): LearnState {
  if (state.phase !== "question") return state;
  const question = state.queue[state.index];
  if (!question) return state;

  const before = state.progress[question.termId];
  let correct = false;
  let closeButTypo = false;
  if (!skipped) {
    if (question.kind === "choice") {
      correct = sameAnswer(input, question.answer);
    } else {
      const g = gradeAnswer(input, question.answer, state.settings.strictness);
      correct = g.correct;
      closeButTypo = g.closeButTypo;
    }
  }

  const after = correct ? promote(before, now, LEARN_STEPS[question.kind]) : demote(before, now);
  const tracked: Progress = correct
    ? question.kind === "written"
      ? { ...after, writtenCorrect: after.writtenCorrect + 1 }
      : { ...after, choiceCorrect: after.choiceCorrect + 1 }
    : after;

  let queue = state.queue;
  let retries = state.retries;
  let seed = state.seed;
  let requeued = false;
  const used = retries[question.termId] ?? 0;
  if (!correct && used < MAX_RETRIES_PER_ROUND) {
    const rng = createRng(seed);
    const term = state.terms.find((t) => t.id === question.termId)!;
    queue = [
      ...queue,
      makeQuestion(state.terms, term, tracked.box, state.settings, rng, `${question.id}-retry${used + 1}`),
    ];
    retries = { ...retries, [question.termId]: used + 1 };
    seed = nextSeed(rng);
    requeued = true;
  }

  return {
    ...state,
    progress: { ...state.progress, [question.termId]: tracked },
    queue,
    retries,
    seed,
    phase: "feedback",
    feedback: { question, input, correct, closeButTypo, skipped, overridden: false, before, requeued },
    attempts: [...state.attempts, { termId: question.termId, kind: question.kind, correct }],
    dirty: addDirty(state.dirty, question.termId),
  };
}

function override(state: LearnState, now: number): LearnState {
  const fb = state.feedback;
  if (state.phase !== "feedback" || !fb || fb.correct || fb.question.kind !== "written") return state;

  const after = promote(fb.before, now, LEARN_STEPS.written);
  const tracked = { ...after, writtenCorrect: after.writtenCorrect + 1 };
  let queue = state.queue;
  let retries = state.retries;
  if (fb.requeued) {
    queue = queue.slice(0, -1);
    retries = { ...retries, [fb.question.termId]: (retries[fb.question.termId] ?? 1) - 1 };
  }
  const attempts = state.attempts.slice();
  const last = attempts[attempts.length - 1];
  if (last && last.termId === fb.question.termId) attempts[attempts.length - 1] = { ...last, correct: true };

  return {
    ...state,
    progress: { ...state.progress, [fb.question.termId]: tracked },
    queue,
    retries,
    attempts,
    feedback: { ...fb, correct: true, closeButTypo: false, overridden: true, requeued: false },
  };
}

export function learnReducer(state: LearnState, action: LearnAction): LearnState {
  switch (action.type) {
    case "answer":
      return grade(state, action.input, action.now ?? Date.now(), false);
    case "skip":
      return grade(state, "", action.now ?? Date.now(), true);
    case "override":
      return override(state, action.now ?? Date.now());
    case "continue": {
      if (state.phase !== "feedback") return state;
      const next = state.index + 1;
      if (next < state.queue.length) return { ...state, index: next, phase: "question", feedback: null };
      return { ...state, phase: "round-summary", feedback: null };
    }
    case "next-round": {
      if (state.phase !== "round-summary") return state;
      if (allMastered(state)) return { ...state, phase: "complete", feedback: null };
      return buildRound({ ...state, round: state.round + 1 }, action.now ?? Date.now());
    }
    case "restart":
      return buildRound({ ...state, round: 1 }, action.now ?? Date.now());
    case "reset": {
      const progress: Record<string, Progress> = {};
      for (const t of state.terms) progress[t.id] = blankProgress(t.id, t.setId);
      return buildRound(
        { ...state, progress, round: 1, dirty: state.terms.map((t) => t.id) },
        action.now ?? Date.now(),
      );
    }
    case "flushed": {
      const gone = new Set(action.termIds);
      return { ...state, dirty: state.dirty.filter((id) => !gone.has(id)) };
    }
    case "set-answer-with": {
      if (action.answerWith === state.settings.answerWith) return state;
      return buildRound(
        { ...state, settings: { ...state.settings, answerWith: action.answerWith } },
        action.now ?? Date.now(),
      );
    }
    default:
      return state;
  }
}

/* --- Selectors ------------------------------------------------------------ */

export function currentQuestion(state: LearnState): LearnQuestion | null {
  return state.queue[state.index] ?? null;
}

export function allMastered(state: LearnState): boolean {
  return state.terms.length > 0 && state.terms.every((t) => isMastered(state.progress[t.id]));
}

export function roundProgress(state: LearnState): { done: number; total: number } {
  const total = state.queue.length;
  if (state.phase === "round-summary" || state.phase === "complete") return { done: total, total };
  return { done: Math.min(total, state.index + (state.phase === "feedback" ? 1 : 0)), total };
}

export function learnSummary(state: LearnState): MasterySummary {
  return summarize(state.terms.map((t) => state.progress[t.id]));
}

export interface RoundTermResult {
  term: Term;
  correct: boolean;
  /** The term needed a retry to get right (or never did). */
  struggled: boolean;
}

/** Per-term outcome for the round that just finished, in the order first asked. */
export function roundResults(state: LearnState): RoundTermResult[] {
  const order: string[] = [];
  const last = new Map<string, boolean>();
  const misses = new Set<string>();
  for (const a of state.attempts) {
    if (!last.has(a.termId)) order.push(a.termId);
    last.set(a.termId, a.correct);
    if (!a.correct) misses.add(a.termId);
  }
  const byId = new Map(state.terms.map((t) => [t.id, t]));
  return order.map((id) => ({
    term: byId.get(id)!,
    correct: last.get(id) ?? false,
    struggled: misses.has(id),
  }));
}

export function roundScore(state: LearnState): { correct: number; total: number } {
  const results = roundResults(state);
  return { correct: results.filter((r) => r.correct).length, total: results.length };
}

export function dirtyProgress(state: LearnState): Progress[] {
  return state.dirty.map((id) => state.progress[id]).filter(Boolean);
}
