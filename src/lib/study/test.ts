import type { Term } from "@/lib/db";
import { buildChoices, pickDistractors } from "./distractors";
import { gradeAnswer, sameAnswer, type Strictness } from "./grading";
import { createRng, shuffle, type Rng } from "./random";

/**
 * Test mode: generate a fixed exam from a config, collect answers, grade the
 * whole thing at once.
 *
 * Question order follows Quizlet's sections — true/false, multiple choice,
 * matching, written — and every term appears at most once.
 */

export type TestQuestionKind = "true-false" | "choice" | "matching" | "written";
export type AnswerSide = "term" | "definition" | "both";
export type Side = "term" | "definition";

export interface TestConfig {
  questionCount: number;
  trueFalse: boolean;
  multipleChoice: boolean;
  matching: boolean;
  written: boolean;
  /** What the learner answers with. `both` alternates per question. */
  answerWith: AnswerSide;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  questionCount: 20,
  trueFalse: true,
  multipleChoice: true,
  matching: true,
  written: true,
  answerWith: "term",
};

export const MAX_MATCHING_PAIRS = 5;
export const TEST_CHOICE_COUNT = 4;

interface QuestionBase {
  id: string;
  kind: TestQuestionKind;
  promptSide: Side;
}

export interface WrittenQuestion extends QuestionBase {
  kind: "written";
  termId: string;
  prompt: string;
  answer: string;
}

export interface ChoiceQuestion extends QuestionBase {
  kind: "choice";
  termId: string;
  prompt: string;
  options: string[];
  answer: string;
}

export interface TrueFalseQuestion extends QuestionBase {
  kind: "true-false";
  termId: string;
  prompt: string;
  /** The candidate pairing shown under the prompt. */
  shown: string;
  isTrue: boolean;
  /** The real counterpart, revealed on the results screen. */
  answer: string;
}

export interface MatchingPair {
  id: string;
  termId: string;
  prompt: string;
  answer: string;
}

export interface MatchingChoice {
  id: string;
  text: string;
}

export interface MatchingQuestion extends QuestionBase {
  kind: "matching";
  pairs: MatchingPair[];
  /** Shuffled answer bank. */
  choices: MatchingChoice[];
  /** pair id → correct choice id */
  answerKey: Record<string, string>;
}

export type TestQuestion = WrittenQuestion | ChoiceQuestion | TrueFalseQuestion | MatchingQuestion;

export interface TestExam {
  config: TestConfig;
  questions: TestQuestion[];
  /** Number of gradable items — matching pairs count individually. */
  total: number;
}

/** written/choice: text; true-false: boolean; matching: pair id → choice id. */
export type TestAnswerValue = string | boolean | Record<string, string>;
export type TestAnswers = Record<string, TestAnswerValue>;

const SECTION_ORDER: TestQuestionKind[] = ["true-false", "choice", "matching", "written"];

const usable = (t: Term) => t.term.trim().length > 0 && t.definition.trim().length > 0;

function enabledKinds(config: TestConfig, termCount: number): TestQuestionKind[] {
  const kinds: TestQuestionKind[] = [];
  if (config.trueFalse && termCount >= 2) kinds.push("true-false");
  if (config.multipleChoice && termCount >= 2) kinds.push("choice");
  if (config.matching && termCount >= 2) kinds.push("matching");
  if (config.written) kinds.push("written");
  if (!kinds.length) kinds.push(termCount >= 2 ? "choice" : "written");
  return kinds;
}

function promptSideFor(config: TestConfig, rng: Rng): Side {
  if (config.answerWith === "term") return "definition";
  if (config.answerWith === "definition") return "term";
  return rng() < 0.5 ? "term" : "definition";
}

const sideText = (t: Term, side: Side) => (side === "term" ? t.term : t.definition);
const other = (side: Side): Side => (side === "term" ? "definition" : "term");

export function generateTest(
  terms: readonly Term[],
  config: TestConfig = DEFAULT_TEST_CONFIG,
  rng: Rng = Math.random,
): TestExam {
  const pool = terms.filter(usable);
  if (!pool.length) return { config, questions: [], total: 0 };

  const count = Math.max(1, Math.min(config.questionCount, pool.length));
  const chosen = shuffle(pool, rng).slice(0, count);
  const kinds = enabledKinds(config, pool.length);

  // Spread questions evenly across enabled kinds; the remainder goes to the
  // earlier sections so a 20-question, 4-type test is 5/5/5/5.
  const buckets = new Map<TestQuestionKind, Term[]>(kinds.map((k) => [k, []]));
  chosen.forEach((t, i) => buckets.get(kinds[i % kinds.length])!.push(t));

  // A matching block needs at least two pairs; a lone term moves to written or choice.
  const matching = buckets.get("matching");
  if (matching && matching.length === 1) {
    const fallback = kinds.includes("written") ? "written" : kinds.includes("choice") ? "choice" : null;
    if (fallback) {
      buckets.get(fallback)!.push(matching[0]);
      buckets.set("matching", []);
    } else {
      // Only matching is enabled and there's one question: borrow a partner.
      const partner = pool.find((t) => !chosen.includes(t));
      if (partner) matching.push(partner);
      else buckets.set("matching", []);
    }
  }

  const questions: TestQuestion[] = [];
  let n = 0;
  const nextId = () => `q${++n}`;

  for (const kind of SECTION_ORDER) {
    const list = buckets.get(kind);
    if (!list?.length) continue;

    if (kind === "matching") {
      for (const block of chunk(list, MAX_MATCHING_PAIRS)) {
        const id = nextId();
        const promptSide = promptSideFor(config, rng);
        const pairs: MatchingPair[] = block.map((t, i) => ({
          id: `${id}-p${i}`,
          termId: t.id,
          prompt: sideText(t, promptSide),
          answer: sideText(t, other(promptSide)),
        }));
        const choices = shuffle(
          pairs.map((p, i) => ({ id: `${id}-c${i}`, text: p.answer, pairId: p.id })),
          rng,
        );
        const answerKey: Record<string, string> = {};
        for (const c of choices) answerKey[c.pairId] = c.id;
        questions.push({
          id,
          kind,
          promptSide,
          pairs,
          choices: choices.map(({ id: cid, text }) => ({ id: cid, text })),
          answerKey,
        });
      }
      continue;
    }

    for (const term of list) {
      const id = nextId();
      const promptSide = promptSideFor(config, rng);
      const prompt = sideText(term, promptSide);
      const answer = sideText(term, other(promptSide));
      const others = pool.filter((t) => t.id !== term.id).map((t) => sideText(t, other(promptSide)));

      if (kind === "written") {
        questions.push({ id, kind, promptSide, termId: term.id, prompt, answer });
      } else if (kind === "choice") {
        questions.push({
          id,
          kind,
          promptSide,
          termId: term.id,
          prompt,
          answer,
          options: buildChoices(answer, others, TEST_CHOICE_COUNT, rng),
        });
      } else {
        const [distractor] = pickDistractors(answer, others, 1, rng);
        const isTrue = !distractor || rng() < 0.5;
        questions.push({
          id,
          kind,
          promptSide,
          termId: term.id,
          prompt,
          shown: isTrue ? answer : distractor,
          isTrue,
          answer,
        });
      }
    }
  }

  return { config, questions, total: countItems(questions) };
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  // Never leave a single pair on its own — fold it into the previous block.
  if (out.length > 1 && out[out.length - 1].length === 1) {
    const last = out.pop()!;
    out[out.length - 1].push(...last);
  }
  return out;
}

export function countItems(questions: readonly TestQuestion[]): number {
  return questions.reduce((n, q) => n + (q.kind === "matching" ? q.pairs.length : 1), 0);
}

/** Convenience: build a seeded exam for a given set id. */
export function generateSeededTest(terms: readonly Term[], config: TestConfig, seed: number): TestExam {
  return generateTest(terms, config, createRng(seed));
}

/* --- Answering ------------------------------------------------------------ */

export function isAnswered(question: TestQuestion, value: TestAnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  switch (question.kind) {
    case "written":
    case "choice":
      return typeof value === "string" && value.trim().length > 0;
    case "true-false":
      return typeof value === "boolean";
    case "matching":
      return (
        typeof value === "object" && question.pairs.every((p) => typeof value[p.id] === "string" && value[p.id])
      );
  }
}

/** Gradable items answered so far (matching pairs count individually). */
export function answeredCount(exam: TestExam, answers: TestAnswers): number {
  let n = 0;
  for (const q of exam.questions) {
    const v = answers[q.id];
    if (q.kind === "matching") {
      if (v && typeof v === "object") n += q.pairs.filter((p) => !!v[p.id]).length;
    } else if (isAnswered(q, v)) n += 1;
  }
  return n;
}

/* --- Grading -------------------------------------------------------------- */

export interface TestResultItem {
  questionId: string;
  /** Set for matching items. */
  pairId?: string;
  termId: string;
  kind: TestQuestionKind;
  correct: boolean;
  unanswered: boolean;
  expected: string;
  given: string;
}

export interface TestReport {
  /** 0–100, rounded. */
  score: number;
  correct: number;
  total: number;
  items: TestResultItem[];
}

export function gradeTest(
  exam: TestExam,
  answers: TestAnswers,
  strictness: Strictness = "lenient",
): TestReport {
  const items: TestResultItem[] = [];

  for (const q of exam.questions) {
    const v = answers[q.id];
    switch (q.kind) {
      case "written": {
        const given = typeof v === "string" ? v : "";
        const result = gradeAnswer(given, q.answer, strictness);
        items.push({
          questionId: q.id,
          termId: q.termId,
          kind: q.kind,
          correct: result.correct,
          unanswered: !given.trim(),
          expected: q.answer,
          given,
        });
        break;
      }
      case "choice": {
        const given = typeof v === "string" ? v : "";
        items.push({
          questionId: q.id,
          termId: q.termId,
          kind: q.kind,
          correct: !!given && sameAnswer(given, q.answer),
          unanswered: !given,
          expected: q.answer,
          given,
        });
        break;
      }
      case "true-false": {
        const given = typeof v === "boolean" ? v : null;
        items.push({
          questionId: q.id,
          termId: q.termId,
          kind: q.kind,
          correct: given === q.isTrue,
          unanswered: given === null,
          expected: q.isTrue ? "True" : "False",
          given: given === null ? "" : given ? "True" : "False",
        });
        break;
      }
      case "matching": {
        const map = v && typeof v === "object" ? v : {};
        const textOf = (choiceId: string | undefined) =>
          q.choices.find((c) => c.id === choiceId)?.text ?? "";
        for (const pair of q.pairs) {
          const choice = map[pair.id];
          items.push({
            questionId: q.id,
            pairId: pair.id,
            termId: pair.termId,
            kind: q.kind,
            correct: !!choice && choice === q.answerKey[pair.id],
            unanswered: !choice,
            expected: pair.answer,
            given: textOf(choice),
          });
        }
        break;
      }
    }
  }

  const correct = items.filter((i) => i.correct).length;
  const total = items.length;
  return { score: total ? Math.round((correct / total) * 100) : 0, correct, total, items };
}
