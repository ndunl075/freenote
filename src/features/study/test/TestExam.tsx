"use client";

import { motion } from "framer-motion";
import { forwardRef, useState } from "react";
import type { MatchingQuestion, TestAnswerValue, TestExam as Exam, TestQuestion } from "@/lib/study/test";
import { Button } from "@/components/ui";
import { riseIn, stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { rowIn } from "../motion";

const sideLabel = (side: "term" | "definition") => (side === "term" ? "Term" : "Definition");
const answerLabel = (side: "term" | "definition") => (side === "term" ? "definition" : "term");

/** Running item numbers per question: matching blocks span several. */
export function numberQuestions(exam: Exam): { start: number; end: number }[] {
  let n = 0;
  return exam.questions.map((q) => {
    const size = q.kind === "matching" ? q.pairs.length : 1;
    const start = n + 1;
    n += size;
    return { start, end: n };
  });
}

export function TestExamView({
  exam,
  answers,
  onAnswer,
  onSubmit,
  answered,
}: {
  exam: Exam;
  answers: Record<string, TestAnswerValue>;
  onAnswer: (questionId: string, value: TestAnswerValue) => void;
  onSubmit: () => void;
  answered: number;
}) {
  const numbers = numberQuestions(exam);
  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-col gap-5 pb-28">
      {exam.questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          number={numbers[i]}
          total={exam.total}
          value={answers[q.id]}
          onChange={(v) => onAnswer(q.id, v)}
        />
      ))}

      <div className="fixed inset-x-0 bottom-0 z-20 bg-[var(--bg-subtle)]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-4">
          <p className="text-[14px] font-semibold text-[var(--text-muted)]" aria-live="polite">
            <span className="tabular-nums text-[var(--text)]">{answered}</span> of {exam.total} answered
          </p>
          <Button size="lg" onClick={onSubmit}>
            Submit test
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export const QuestionCard = forwardRef<
  HTMLElement,
  {
    question: TestQuestion;
    number: { start: number; end: number };
    total: number;
    value: TestAnswerValue | undefined;
    onChange: (v: TestAnswerValue) => void;
  }
>(function QuestionCard({ question: q, number, total, value, onChange }, ref) {
  const label = number.start === number.end ? `${number.start} of ${total}` : `${number.start}–${number.end} of ${total}`;
  return (
    <motion.article
      ref={ref}
      id={`question-${q.id}`}
      variants={riseIn}
      data-question-id={q.id}
      className="rounded-[16px] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-8"
      aria-labelledby={`${q.id}-prompt`}
    >
      <header className="flex items-center justify-between text-[13px] font-semibold text-[var(--text-muted)]">
        <span>{q.kind === "matching" ? "Matching" : sideLabel(q.promptSide)}</span>
        <span className="tabular-nums">{label}</span>
      </header>

      {q.kind === "matching" ? (
        <MatchingBody
          question={q}
          value={value && typeof value === "object" ? value : {}}
          onChange={onChange}
        />
      ) : (
        <>
          <p id={`${q.id}-prompt`} className="mt-4 whitespace-pre-wrap break-words text-[18px] leading-snug text-[var(--text)] md:text-[22px]">
            {q.prompt}
          </p>

          {q.kind === "written" && (
            <div className="mt-6">
              <label htmlFor={`${q.id}-input`} className="mb-2 block text-[13px] font-semibold text-[var(--text-muted)]">
                Your answer
              </label>
              <input
                id={`${q.id}-input`}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`Type the ${answerLabel(q.promptSide)}`}
                autoComplete="off"
                className={cn(
                  "h-14 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[17px]",
                  "text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--brand)]",
                )}
              />
            </div>
          )}

          {q.kind === "choice" && (
            <div className="mt-6">
              <p className="mb-3 text-[13px] font-semibold text-[var(--text-muted)]">
                Choose the matching {answerLabel(q.promptSide)}
              </p>
              <motion.div role="radiogroup" aria-label="Answer choices" variants={stagger(0.03)} className="grid gap-3 md:grid-cols-2">
                {q.options.map((opt, i) => {
                  const selected = value === opt;
                  return (
                    <motion.button
                      key={opt + i}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      variants={rowIn}
                      onClick={() => onChange(opt)}
                      className={cn(
                        "flex min-h-[60px] items-center gap-3 rounded-[8px] border px-4 py-3 text-left text-[16px] font-medium transition-colors",
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text)]"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold",
                          selected ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-[var(--text-muted)]",
                        )}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span className="whitespace-pre-wrap break-words">{opt}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          )}

          {q.kind === "true-false" && (
            <div className="mt-5">
              <div className="rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  {sideLabel(q.promptSide === "term" ? "definition" : "term")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[16px] font-medium">{q.shown}</p>
              </div>
              <div role="radiogroup" aria-label="True or false" className="mt-4 grid grid-cols-2 gap-3">
                {[true, false].map((v) => {
                  const selected = value === v;
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(v)}
                      className={cn(
                        "h-14 rounded-[8px] border text-[16px] font-bold transition-colors",
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text)]"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
                      )}
                    >
                      {v ? "True" : "False"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </motion.article>
  );
});

function MatchingBody({
  question: q,
  value,
  onChange,
}: {
  question: MatchingQuestion;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <p id={`${q.id}-prompt`} className="text-[15px] font-semibold text-[var(--text-muted)]">
        Match each {q.promptSide} with its {answerLabel(q.promptSide)}
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-[var(--border-soft)]">
        {q.pairs.map((pair) => {
          const chosen = value[pair.id] ?? "";
          const taken = new Set(Object.entries(value).filter(([k]) => k !== pair.id).map(([, v]) => v));
          return (
            <li key={pair.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-6">
              <label htmlFor={`${pair.id}-select`} className="whitespace-pre-wrap break-words text-[16px] font-medium text-[var(--text)]">
                {pair.prompt}
              </label>
              <select
                id={`${pair.id}-select`}
                value={chosen}
                onFocus={() => setFocused(pair.id)}
                onBlur={() => setFocused(null)}
                onChange={(e) => onChange({ ...value, [pair.id]: e.target.value })}
                className={cn(
                  "h-11 w-full rounded-[8px] border bg-[var(--surface)] px-3 text-[15px] font-medium text-[var(--text)] outline-none",
                  chosen ? "border-[var(--brand)]" : "border-[var(--border)]",
                  focused === pair.id && "border-[var(--brand)]",
                )}
              >
                <option value="">Choose answer</option>
                {q.choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {taken.has(c.id) ? `${c.text} (used)` : c.text}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
