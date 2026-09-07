import { normalizeAnswer } from "./grading";
import { shuffle, type Rng } from "./random";

/**
 * Wrong answers for multiple choice.
 *
 * A distractor is only useful if it looks like it could be right: a
 * two-word definition next to three single-word ones gives the game away.
 * Candidates are scored on length, word count, and shape (numeric,
 * capitalised) and a little jitter keeps the same wrong answers from
 * appearing every time.
 */

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isNumeric = (s: string) => /^[\d\s.,%$€£+-]+$/.test(s.trim()) && /\d/.test(s);
const startsUpper = (s: string) => /^[A-Z]/.test(s.trim());

/** Lower is more similar. */
export function shapeScore(candidate: string, answer: string): number {
  const lenDiff = Math.abs(candidate.length - answer.length);
  const wordsDiff = Math.abs(wordCount(candidate) - wordCount(answer));
  const numeric = isNumeric(candidate) === isNumeric(answer) ? 0 : 12;
  const capital = startsUpper(candidate) === startsUpper(answer) ? 0 : 2;
  return lenDiff * 0.5 + wordsDiff * 3 + numeric + capital;
}

/**
 * Up to `count` plausible wrong options drawn from `pool`. Never returns the
 * answer itself (or anything that normalises to it), never repeats an option.
 */
export function pickDistractors(
  answer: string,
  pool: readonly string[],
  count = 3,
  rng: Rng = Math.random,
): string[] {
  const seen = new Set<string>([normalizeAnswer(answer)]);
  const unique: string[] = [];
  for (const candidate of pool) {
    const key = normalizeAnswer(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  if (unique.length <= count) return shuffle(unique, rng);

  const scored = unique.map((c) => ({ c, s: shapeScore(c, answer) + rng() * 4 }));
  scored.sort((a, b) => a.s - b.s);
  return scored.slice(0, count).map((x) => x.c);
}

/** Shuffled option list containing the answer plus distractors. */
export function buildChoices(
  answer: string,
  pool: readonly string[],
  count = 4,
  rng: Rng = Math.random,
): string[] {
  const distractors = pickDistractors(answer, pool, Math.max(0, count - 1), rng);
  return shuffle([answer, ...distractors], rng);
}
