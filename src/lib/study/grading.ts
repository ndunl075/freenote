/**
 * Answer grading for Learn, Test, and Blast.
 *
 * Quizlet's "smart grading" forgives the things that don't prove you don't
 * know the answer: capitalisation, accents, punctuation, a leading article,
 * and a typo or two on a long word. `strict` keeps case-insensitivity and
 * whitespace trimming but nothing else.
 */

export type Strictness = "lenient" | "strict";

export interface GradeResult {
  correct: boolean;
  /** Accepted, but only because typo tolerance kicked in. */
  closeButTypo: boolean;
}

const ARTICLES = new Set(["the", "a", "an"]);

// ASCII punctuation plus the Unicode marks that show up in pasted definitions.
// Written out rather than as \p{P} so it compiles under the ES2017 target.
const PUNCTUATION = /[!-\/:-@\[-`{-~¡¿«»“”„‚‹›–—…·•]/g;
const APOSTROPHES = /['’‘]/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "");
}

/**
 * Canonical form used for comparison.
 * - strict: trim, collapse whitespace, lowercase.
 * - lenient: also drop accents, punctuation, and a leading article.
 */
export function normalizeAnswer(text: string, strictness: Strictness = "lenient"): string {
  const out = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (strictness === "strict") return out;

  const cleaned = stripAccents(out).replace(APOSTROPHES, "").replace(PUNCTUATION, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}

/**
 * Edit distance with adjacent transpositions counted as one edit (optimal
 * string alignment). "teh" is one typo away from "the", not two.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev2: number[] = [];
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);

  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, prev2[j - 2] + 1);
      }
      cur[j] = best;
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How many edits a lenient grader forgives, by expected-answer length. */
export function typoAllowance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  if (length <= 14) return 2;
  return 3;
}

/**
 * Every normalised form an expected answer can be matched as. In lenient mode
 * "colour / color" accepts either spelling and "cat (animal)" accepts "cat".
 */
export function acceptedForms(expected: string, strictness: Strictness = "lenient"): string[] {
  const forms = new Set<string>();
  const base = normalizeAnswer(expected, strictness);
  if (base) forms.add(base);
  if (strictness === "strict") return [...forms];

  if (expected.includes("/")) {
    const parts = expected.split("/").map((p) => normalizeAnswer(p));
    if (parts.every((p) => p.length >= 3)) parts.forEach((p) => forms.add(p));
  }
  if (/\([^)]*\)/.test(expected)) {
    const bare = normalizeAnswer(expected.replace(/\([^)]*\)/g, " "));
    if (bare) forms.add(bare);
  }
  return [...forms];
}

export function gradeAnswer(
  input: string,
  expected: string,
  strictness: Strictness = "lenient",
): GradeResult {
  const given = normalizeAnswer(input, strictness);
  if (!given) return { correct: false, closeButTypo: false };

  const forms = acceptedForms(expected, strictness);
  if (forms.some((f) => f === given)) return { correct: true, closeButTypo: false };
  if (strictness === "strict") return { correct: false, closeButTypo: false };

  for (const form of forms) {
    const allowance = typoAllowance(form.length);
    if (allowance === 0) continue;
    if (levenshtein(given, form) <= allowance) return { correct: true, closeButTypo: true };
  }
  return { correct: false, closeButTypo: false };
}

/** Exact-after-normalisation equality; what multiple choice uses. */
export function sameAnswer(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}
