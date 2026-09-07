import { describe, expect, it } from "vitest";
import type { Progress, Term } from "@/lib/db";
import {
  allMastered,
  createLearnState,
  currentQuestion,
  dirtyProgress,
  learnReducer,
  learnSummary,
  ROUND_SIZE,
  roundProgress,
  roundResults,
  roundScore,
  type LearnState,
} from "./learn";
import { MASTERED_BOX, WRITTEN_BOX } from "./scheduler";

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

const NOW = 1_700_000_000_000;

function fresh(n = 10, opts: Parameters<typeof createLearnState>[2] = {}): LearnState {
  return createLearnState(makeTerms(n), [], { seed: 1, now: NOW, ...opts });
}

/** Answer the current question correctly and continue. */
function ace(state: LearnState, now = NOW): LearnState {
  const q = currentQuestion(state)!;
  const answered = learnReducer(state, { type: "answer", input: q.answer, now });
  return learnReducer(answered, { type: "continue" });
}

function flunk(state: LearnState, now = NOW): LearnState {
  const answered = learnReducer(state, { type: "answer", input: "definitely wrong", now });
  return learnReducer(answered, { type: "continue" });
}

describe("createLearnState", () => {
  it("builds a first round of seven multiple-choice questions", () => {
    const s = fresh(12);
    expect(s.round).toBe(1);
    expect(s.phase).toBe("question");
    expect(s.queue).toHaveLength(ROUND_SIZE);
    expect(s.queue.every((q) => q.kind === "choice")).toBe(true);
    expect(s.queue.every((q) => q.options.length === 4)).toBe(true);
    expect(s.queue.every((q) => q.options.includes(q.answer))).toBe(true);
    expect(new Set(s.queue.map((q) => q.termId)).size).toBe(ROUND_SIZE);
  });

  it("answers with the term by default: prompt is the definition", () => {
    const q = currentQuestion(fresh(5))!;
    expect(q.promptSide).toBe("definition");
    expect(q.prompt.startsWith("definition")).toBe(true);
    expect(q.answer.startsWith("term")).toBe(true);
  });

  it("can answer with the definition instead", () => {
    const q = currentQuestion(fresh(5, { answerWith: "definition" }))!;
    expect(q.promptSide).toBe("term");
    expect(q.answer.startsWith("definition")).toBe(true);
  });

  it("shrinks the round to the number of terms and is complete with no terms", () => {
    expect(fresh(3).queue).toHaveLength(3);
    expect(fresh(0).phase).toBe("complete");
  });

  it("skips blank terms and picks up existing progress", () => {
    const terms = [...makeTerms(3), { ...makeTerms(4)[3], term: " ", definition: "" }];
    const progress: Progress[] = [
      {
        termId: "t0",
        setId: "set",
        box: MASTERED_BOX,
        streak: 3,
        lapses: 0,
        seen: 3,
        correct: 3,
        dueAt: NOW + 1,
        lastSeenAt: NOW,
        writtenCorrect: 1,
        choiceCorrect: 1,
      },
    ];
    const s = createLearnState(terms, progress, { seed: 1, now: NOW });
    expect(s.terms).toHaveLength(3);
    expect(s.queue.map((q) => q.termId)).not.toContain("t0");
    expect(s.queue).toHaveLength(2);
  });

  it("uses written questions for terms already past the choice stage", () => {
    const progress: Progress[] = [
      {
        termId: "t1",
        setId: "set",
        box: WRITTEN_BOX,
        streak: 1,
        lapses: 0,
        seen: 1,
        correct: 1,
        dueAt: 0,
        lastSeenAt: 0,
        writtenCorrect: 0,
        choiceCorrect: 1,
      },
    ];
    const s = createLearnState(makeTerms(4), progress, { seed: 1, now: NOW });
    expect(s.queue.find((q) => q.termId === "t1")?.kind).toBe("written");
  });

  it("falls back to written when there is nothing to build choices from", () => {
    expect(currentQuestion(fresh(1))?.kind).toBe("written");
  });

  it("is deterministic for a seed", () => {
    expect(fresh(10, { seed: 5 }).queue).toEqual(fresh(10, { seed: 5 }).queue);
  });
});

describe("answering", () => {
  it("promotes on a correct choice and enters feedback", () => {
    const s = fresh(10);
    const q = currentQuestion(s)!;
    const next = learnReducer(s, { type: "answer", input: q.answer, now: NOW });
    expect(next.phase).toBe("feedback");
    expect(next.feedback?.correct).toBe(true);
    expect(next.progress[q.termId].box).toBe(2);
    expect(next.progress[q.termId].choiceCorrect).toBe(1);
    expect(next.dirty).toEqual([q.termId]);
    expect(next.queue).toHaveLength(ROUND_SIZE);
  });

  it("demotes, reveals and re-queues on a wrong choice", () => {
    const s = fresh(10);
    const q = currentQuestion(s)!;
    const next = learnReducer(s, { type: "answer", input: "nope", now: NOW });
    expect(next.feedback?.correct).toBe(false);
    expect(next.feedback?.requeued).toBe(true);
    expect(next.progress[q.termId].box).toBe(0);
    expect(next.progress[q.termId].lapses).toBe(1);
    expect(next.queue).toHaveLength(ROUND_SIZE + 1);
    expect(next.queue[next.queue.length - 1].termId).toBe(q.termId);
  });

  it("re-asks a missed term at most once per round", () => {
    let s = fresh(3);
    const target = currentQuestion(s)!.termId;
    s = flunk(s);
    s = ace(s);
    s = ace(s);
    // Retry of the target is now the current question.
    expect(currentQuestion(s)?.termId).toBe(target);
    s = learnReducer(s, { type: "answer", input: "still wrong", now: NOW });
    expect(s.feedback?.requeued).toBe(false);
    expect(s.queue).toHaveLength(4);
  });

  it("ignores answers outside the question phase", () => {
    const s = fresh(5);
    const inFeedback = learnReducer(s, { type: "answer", input: "x", now: NOW });
    expect(learnReducer(inFeedback, { type: "answer", input: "y", now: NOW })).toBe(inFeedback);
  });

  it("skip counts as a miss", () => {
    const s = fresh(5);
    const next = learnReducer(s, { type: "skip", now: NOW });
    expect(next.feedback?.skipped).toBe(true);
    expect(next.feedback?.correct).toBe(false);
    expect(next.attempts[0].correct).toBe(false);
  });

  it("grades written answers with typo tolerance", () => {
    const s = fresh(1); // single term → written
    const q = currentQuestion(s)!;
    expect(q.kind).toBe("written");
    const next = learnReducer(s, { type: "answer", input: q.answer.replace("term", "trem"), now: NOW });
    expect(next.feedback?.correct).toBe(true);
    expect(next.feedback?.closeButTypo).toBe(true);
    expect(next.progress[q.termId].box).toBe(3);
    expect(next.progress[q.termId].writtenCorrect).toBe(1);
  });

  it("lets the learner override a written miss", () => {
    const s = fresh(1);
    const q = currentQuestion(s)!;
    const missed = learnReducer(s, { type: "answer", input: "wrong", now: NOW });
    expect(missed.queue).toHaveLength(2);
    const fixed = learnReducer(missed, { type: "override", now: NOW });
    expect(fixed.feedback?.correct).toBe(true);
    expect(fixed.feedback?.overridden).toBe(true);
    expect(fixed.queue).toHaveLength(1);
    expect(fixed.progress[q.termId].box).toBe(3);
    expect(fixed.progress[q.termId].lapses).toBe(0);
    expect(fixed.attempts[0].correct).toBe(true);
  });

  it("does not allow overriding a choice question or a correct answer", () => {
    const s = fresh(5);
    const q = currentQuestion(s)!;
    const wrongChoice = learnReducer(s, { type: "answer", input: "no", now: NOW });
    expect(learnReducer(wrongChoice, { type: "override" })).toBe(wrongChoice);
    const right = learnReducer(s, { type: "answer", input: q.answer, now: NOW });
    expect(learnReducer(right, { type: "override" })).toBe(right);
  });
});

describe("rounds", () => {
  it("tracks progress through the round and lands on a summary", () => {
    let s = fresh(3);
    expect(roundProgress(s)).toEqual({ done: 0, total: 3 });
    s = learnReducer(s, { type: "answer", input: currentQuestion(s)!.answer, now: NOW });
    expect(roundProgress(s)).toEqual({ done: 1, total: 3 });
    s = learnReducer(s, { type: "continue" });
    expect(s.index).toBe(1);
    s = ace(s);
    s = ace(s);
    expect(s.phase).toBe("round-summary");
    expect(roundProgress(s)).toEqual({ done: 3, total: 3 });
    expect(roundScore(s)).toEqual({ correct: 3, total: 3 });
    expect(learnSummary(s)).toEqual({ total: 3, notStarted: 0, learning: 3, mastered: 0 });
  });

  it("reports per-term results including struggles", () => {
    let s = fresh(2);
    const first = currentQuestion(s)!.termId;
    s = flunk(s);
    s = ace(s);
    s = ace(s); // retry of first
    expect(s.phase).toBe("round-summary");
    const results = roundResults(s);
    expect(results).toHaveLength(2);
    expect(results[0].term.id).toBe(first);
    expect(results[0].correct).toBe(true);
    expect(results[0].struggled).toBe(true);
    expect(results[1].struggled).toBe(false);
  });

  it("graduates terms to written in the next round and masters them", () => {
    let s = fresh(3);
    s = ace(s);
    s = ace(s);
    s = ace(s);
    expect(s.phase).toBe("round-summary");
    s = learnReducer(s, { type: "next-round", now: NOW });
    expect(s.round).toBe(2);
    expect(s.phase).toBe("question");
    expect(s.queue.every((q) => q.kind === "written")).toBe(true);
    s = ace(s);
    s = ace(s);
    s = ace(s);
    expect(allMastered(s)).toBe(true);
    expect(learnSummary(s).mastered).toBe(3);
    s = learnReducer(s, { type: "next-round", now: NOW });
    expect(s.phase).toBe("complete");
  });

  it("keeps unmastered terms coming round after round", () => {
    let s = fresh(10);
    for (let i = 0; i < ROUND_SIZE; i++) s = ace(s);
    s = learnReducer(s, { type: "next-round", now: NOW });
    // Three untouched terms are due and come first; the rest fill the round.
    const boxes = s.queue.map((q) => s.progress[q.termId].box);
    expect(boxes.slice(0, 3)).toEqual([0, 0, 0]);
    expect(s.queue).toHaveLength(ROUND_SIZE);
  });

  it("restart rebuilds round one without losing progress; reset clears it", () => {
    let s = fresh(3);
    s = ace(s);
    const restarted = learnReducer(s, { type: "restart", now: NOW });
    expect(restarted.round).toBe(1);
    expect(restarted.index).toBe(0);
    expect(Object.values(restarted.progress).some((p) => p.box > 0)).toBe(true);

    const reset = learnReducer(s, { type: "reset", now: NOW });
    expect(Object.values(reset.progress).every((p) => p.box === 0 && p.seen === 0)).toBe(true);
    expect(reset.dirty.sort()).toEqual(["t0", "t1", "t2"]);
  });

  it("flushes dirty progress and switches answer side", () => {
    let s = fresh(3);
    s = learnReducer(s, { type: "answer", input: currentQuestion(s)!.answer, now: NOW });
    expect(dirtyProgress(s)).toHaveLength(1);
    s = learnReducer(s, { type: "flushed", termIds: s.dirty });
    expect(s.dirty).toEqual([]);

    const flipped = learnReducer(s, { type: "set-answer-with", answerWith: "definition", now: NOW });
    expect(flipped.settings.answerWith).toBe("definition");
    expect(flipped.index).toBe(0);
    expect(currentQuestion(flipped)?.promptSide).toBe("term");
    expect(learnReducer(flipped, { type: "set-answer-with", answerWith: "definition" })).toBe(flipped);
  });
});
