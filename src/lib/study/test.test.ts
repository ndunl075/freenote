import { describe, expect, it } from "vitest";
import type { Term } from "@/lib/db";
import { createRng } from "./random";
import {
  answeredCount,
  countItems,
  DEFAULT_TEST_CONFIG,
  generateSeededTest,
  generateTest,
  gradeTest,
  isAnswered,
  MAX_MATCHING_PAIRS,
  type MatchingQuestion,
  type TestAnswers,
  type TestConfig,
} from "./test";

const makeTerms = (n: number): Term[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    setId: "set",
    term: `term ${i}`,
    definition: `definition ${i}`,
    imageBlobId: null,
    order: i,
    starred: false,
  }));

const cfg = (patch: Partial<TestConfig> = {}): TestConfig => ({ ...DEFAULT_TEST_CONFIG, ...patch });

describe("generateTest", () => {
  it("spreads questions across enabled types in section order", () => {
    const exam = generateTest(makeTerms(30), cfg({ questionCount: 20 }), createRng(1));
    const kinds = exam.questions.map((q) => q.kind);
    expect(kinds.filter((k) => k === "true-false")).toHaveLength(5);
    expect(kinds.filter((k) => k === "choice")).toHaveLength(5);
    expect(kinds.filter((k) => k === "written")).toHaveLength(5);
    const matching = exam.questions.filter((q): q is MatchingQuestion => q.kind === "matching");
    expect(matching.reduce((n, q) => n + q.pairs.length, 0)).toBe(5);
    expect(exam.total).toBe(20);

    const order = ["true-false", "choice", "matching", "written"];
    const seen = kinds.map((k) => order.indexOf(k));
    expect(seen).toEqual(seen.slice().sort((a, b) => a - b));
  });

  it("caps the count at the number of usable terms and never repeats a term", () => {
    const terms = [...makeTerms(6), { ...makeTerms(7)[6], definition: "" }];
    const exam = generateTest(terms, cfg({ questionCount: 50 }), createRng(2));
    expect(exam.total).toBe(6);
    const ids = exam.questions.flatMap((q) => (q.kind === "matching" ? q.pairs.map((p) => p.termId) : [q.termId]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("t6");
  });

  it("returns an empty exam with no terms", () => {
    expect(generateTest([], cfg()).questions).toEqual([]);
  });

  it("respects the answer side", () => {
    const withTerm = generateTest(makeTerms(8), cfg({ answerWith: "term", matching: false }), createRng(3));
    expect(withTerm.questions.every((q) => q.promptSide === "definition")).toBe(true);
    const withDef = generateTest(makeTerms(8), cfg({ answerWith: "definition", matching: false }), createRng(3));
    expect(withDef.questions.every((q) => q.promptSide === "term")).toBe(true);
  });

  it("builds choice questions with four options including the answer", () => {
    const exam = generateTest(
      makeTerms(10),
      cfg({ trueFalse: false, matching: false, written: false, questionCount: 10 }),
      createRng(4),
    );
    for (const q of exam.questions) {
      expect(q.kind).toBe("choice");
      if (q.kind === "choice") {
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(4);
      }
    }
  });

  it("builds true/false questions whose shown text matches isTrue", () => {
    const exam = generateTest(
      makeTerms(10),
      cfg({ multipleChoice: false, matching: false, written: false, questionCount: 10 }),
      createRng(5),
    );
    let trues = 0;
    for (const q of exam.questions) {
      expect(q.kind).toBe("true-false");
      if (q.kind === "true-false") {
        expect(q.shown === q.answer).toBe(q.isTrue);
        if (q.isTrue) trues++;
      }
    }
    expect(trues).toBeGreaterThan(0);
    expect(trues).toBeLessThan(10);
  });

  it("chunks matching into blocks and never leaves a lone pair", () => {
    const exam = generateTest(
      makeTerms(12),
      cfg({ trueFalse: false, multipleChoice: false, written: false, questionCount: 11 }),
      createRng(6),
    );
    const blocks = exam.questions as MatchingQuestion[];
    expect(blocks.every((b) => b.kind === "matching")).toBe(true);
    expect(blocks.map((b) => b.pairs.length)).toEqual([MAX_MATCHING_PAIRS, MAX_MATCHING_PAIRS + 1]);
    for (const b of blocks) {
      expect(b.choices).toHaveLength(b.pairs.length);
      for (const p of b.pairs) {
        const choice = b.choices.find((c) => c.id === b.answerKey[p.id]);
        expect(choice?.text).toBe(p.answer);
      }
    }
    expect(countItems(exam.questions)).toBe(11);
  });

  it("moves a single matching term to another type", () => {
    const exam = generateTest(makeTerms(5), cfg({ questionCount: 5, trueFalse: false, multipleChoice: false }), createRng(7));
    const kinds = exam.questions.map((q) => q.kind);
    // 5 questions across matching + written → 3 matching, 2 written.
    expect(kinds.filter((k) => k === "matching")).toHaveLength(1);
    expect(exam.total).toBe(5);

    const lone = generateTest(makeTerms(3), cfg({ questionCount: 1, trueFalse: false, multipleChoice: false }), createRng(7));
    expect(lone.questions[0].kind).toBe("written");
  });

  it("falls back to a sensible type when nothing is enabled", () => {
    const none = cfg({ trueFalse: false, multipleChoice: false, matching: false, written: false, questionCount: 4 });
    expect(generateTest(makeTerms(4), none, createRng(1)).questions.every((q) => q.kind === "choice")).toBe(true);
    expect(generateTest(makeTerms(1), none, createRng(1)).questions[0].kind).toBe("written");
  });

  it("is reproducible with a seed", () => {
    expect(generateSeededTest(makeTerms(15), cfg(), 99)).toEqual(generateSeededTest(makeTerms(15), cfg(), 99));
  });
});

describe("answers and grading", () => {
  const exam = generateTest(makeTerms(16), cfg({ questionCount: 16 }), createRng(8));

  function perfect(): TestAnswers {
    const answers: TestAnswers = {};
    for (const q of exam.questions) {
      if (q.kind === "written" || q.kind === "choice") answers[q.id] = q.answer;
      else if (q.kind === "true-false") answers[q.id] = q.isTrue;
      else answers[q.id] = { ...q.answerKey };
    }
    return answers;
  }

  it("tracks answered items, counting matching pairs individually", () => {
    expect(answeredCount(exam, {})).toBe(0);
    expect(answeredCount(exam, perfect())).toBe(exam.total);

    const matching = exam.questions.find((q): q is MatchingQuestion => q.kind === "matching")!;
    const firstPair = matching.pairs[0];
    const partial: TestAnswers = { [matching.id]: { [firstPair.id]: matching.answerKey[firstPair.id] } };
    expect(answeredCount(exam, partial)).toBe(1);
    expect(isAnswered(matching, partial[matching.id])).toBe(false);
    expect(isAnswered(exam.questions[0], "")).toBe(false);
    expect(isAnswered(exam.questions[0], undefined)).toBe(false);
  });

  it("scores a perfect submission at 100", () => {
    const report = gradeTest(exam, perfect());
    expect(report.score).toBe(100);
    expect(report.correct).toBe(exam.total);
    expect(report.total).toBe(exam.total);
    expect(report.items.every((i) => i.correct && !i.unanswered)).toBe(true);
  });

  it("scores an empty submission at 0 and marks everything unanswered", () => {
    const report = gradeTest(exam, {});
    expect(report.score).toBe(0);
    expect(report.items.every((i) => !i.correct && i.unanswered)).toBe(true);
    expect(report.items).toHaveLength(exam.total);
  });

  it("uses lenient grading for written answers", () => {
    const written = exam.questions.find((q) => q.kind === "written")!;
    const answers: TestAnswers = { [written.id]: written.kind === "written" ? written.answer.toUpperCase() + "!" : "" };
    const item = gradeTest(exam, answers).items.find((i) => i.questionId === written.id)!;
    expect(item.correct).toBe(true);
    const strict = gradeTest(exam, answers, "strict").items.find((i) => i.questionId === written.id)!;
    expect(strict.correct).toBe(false);
  });

  it("reports expected and given text for wrong answers", () => {
    const tf = exam.questions.find((q) => q.kind === "true-false")!;
    const choice = exam.questions.find((q) => q.kind === "choice")!;
    const matching = exam.questions.find((q): q is MatchingQuestion => q.kind === "matching")!;
    const wrongChoiceId = matching.choices.find((c) => c.id !== matching.answerKey[matching.pairs[0].id])!.id;

    const answers: TestAnswers = {
      [tf.id]: tf.kind === "true-false" ? !tf.isTrue : false,
      [choice.id]: "not an option",
      [matching.id]: { [matching.pairs[0].id]: wrongChoiceId },
    };
    const { items } = gradeTest(exam, answers);

    const tfItem = items.find((i) => i.questionId === tf.id)!;
    expect(tfItem.correct).toBe(false);
    expect(["True", "False"]).toContain(tfItem.expected);
    expect(tfItem.given).not.toBe(tfItem.expected);

    const choiceItem = items.find((i) => i.questionId === choice.id)!;
    expect(choiceItem.correct).toBe(false);
    expect(choiceItem.given).toBe("not an option");

    const pairItem = items.find((i) => i.pairId === matching.pairs[0].id)!;
    expect(pairItem.correct).toBe(false);
    expect(pairItem.expected).toBe(matching.pairs[0].answer);
    expect(pairItem.given).toBe(matching.choices.find((c) => c.id === wrongChoiceId)!.text);
  });
});
