"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { TestExam, TestReport, TestResultItem } from "@/lib/study/test";
import { Button, ProgressRing } from "@/components/ui";
import { riseIn, stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { clock } from "@/lib/utils/format";
import { Confetti } from "../Confetti";
import { rowIn } from "../motion";
import { routes } from "../routes";
import { NavButton } from "../NavButton";
import { numberQuestions } from "./TestExam";

function headline(score: number): string {
  if (score === 100) return "Perfect score!";
  if (score >= 80) return "Excellent work!";
  if (score >= 60) return "Nice job — keep practicing.";
  return "Keep studying, you'll get there.";
}

export function TestResults({
  setId,
  exam,
  report,
  elapsedMs,
  onRetake,
}: {
  setId: string;
  exam: TestExam;
  report: TestReport;
  elapsedMs: number;
  onRetake: () => void;
}) {
  const numbers = numberQuestions(exam);
  const incorrect = report.total - report.correct;
  const byQuestion = new Map<string, TestResultItem[]>();
  for (const item of report.items) {
    const list = byQuestion.get(item.questionId) ?? [];
    list.push(item);
    byQuestion.set(item.questionId, list);
  }

  return (
    <motion.section variants={stagger(0.05)} initial="hidden" animate="show" className="relative pb-16" aria-live="polite">
      {report.score === 100 && <Confetti />}
      <motion.div
        variants={riseIn}
        className="grid items-center gap-6 rounded-[16px] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] md:grid-cols-[auto_1fr] md:gap-10 md:p-8"
      >
        <ProgressRing value={report.correct} max={Math.max(1, report.total)} size={156} stroke={12} tone={report.score >= 80 ? "correct" : "brand"}>
          <span className="text-[36px] font-extrabold tabular-nums">{report.score}%</span>
        </ProgressRing>
        <div>
          <h2 className="text-[26px] leading-tight md:text-[32px]">{headline(report.score)}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="correct">
              <Check className="h-4 w-4" strokeWidth={3} /> {report.correct} correct
            </Pill>
            <Pill tone="incorrect">
              <X className="h-4 w-4" strokeWidth={3} /> {incorrect} incorrect
            </Pill>
            <Pill>Time {clock(elapsedMs)}</Pill>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onRetake}>Take a new test</Button>
            <NavButton href={routes.set(setId)} variant="secondary">
                Back to set
              </NavButton>
          </div>
        </div>
      </motion.div>

      <motion.h3 variants={riseIn} className="mt-10 text-[20px]">
        Your answers
      </motion.h3>
      <motion.ol variants={stagger(0.03)} className="mt-4 flex flex-col gap-4">
        {exam.questions.map((q, i) => {
          const items = byQuestion.get(q.id) ?? [];
          const allRight = items.every((it) => it.correct);
          const anyAnswered = items.some((it) => !it.unanswered);
          const num = numbers[i];
          return (
            <motion.li
              key={q.id}
              variants={rowIn}
              className={cn(
                "rounded-[16px] border-l-4 bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6",
                allRight ? "border-[var(--correct)]" : "border-[var(--incorrect)]",
              )}
            >
              <header className="flex items-center justify-between gap-3 text-[13px] font-semibold text-[var(--text-muted)]">
                <span className="tabular-nums">{num.start === num.end ? `${num.start} of ${exam.total}` : `${num.start}–${num.end} of ${exam.total}`}</span>
                <Pill tone={allRight ? "correct" : anyAnswered ? "incorrect" : undefined}>
                  {allRight ? "Correct" : anyAnswered ? (items.length > 1 ? `${items.filter((x) => x.correct).length} / ${items.length} correct` : "Incorrect") : "Not answered"}
                </Pill>
              </header>

              {q.kind !== "matching" ? (
                <>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[17px] font-medium text-[var(--text)]">{q.prompt}</p>
                  {q.kind === "true-false" && (
                    <p className="mt-2 text-[15px] text-[var(--text-muted)]">
                      Shown: <span className="font-medium text-[var(--text)]">{q.shown}</span>
                    </p>
                  )}
                  {items[0] && <AnswerLines item={items[0]} />}
                </>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--border-soft)]">
                  {q.pairs.map((pair) => {
                    const item = items.find((it) => it.pairId === pair.id);
                    if (!item) return null;
                    return (
                      <li key={pair.id} className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
                        <span className="text-[15px] font-medium">{pair.prompt}</span>
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full",
                            item.correct ? "bg-[var(--correct-bg)] text-[var(--correct-text)]" : "bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]",
                          )}
                          aria-label={item.correct ? "Correct" : "Incorrect"}
                        >
                          {item.correct ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="text-[15px]">
                          {item.correct ? (
                            <span className="text-[var(--correct-text)]">{item.expected}</span>
                          ) : (
                            <>
                              {item.given && <span className="text-[var(--incorrect-text)] line-through">{item.given}</span>}
                              {item.given && " "}
                              <span className="text-[var(--correct-text)]">{item.expected}</span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.li>
          );
        })}
      </motion.ol>
    </motion.section>
  );
}

function AnswerLines({ item }: { item: TestResultItem }) {
  return (
    <dl className="mt-4 grid gap-2 text-[15px]">
      {!item.correct && (
        <div className="flex gap-2">
          <dt className="w-[128px] shrink-0 font-semibold text-[var(--text-muted)]">Your answer</dt>
          <dd className={cn("font-medium", item.unanswered ? "text-[var(--text-faint)]" : "text-[var(--incorrect-text)]")}>
            {item.unanswered ? "Not answered" : item.given}
          </dd>
        </div>
      )}
      <div className="flex gap-2">
        <dt className="w-[128px] shrink-0 font-semibold text-[var(--text-muted)]">
          {item.correct ? "Your answer" : "Correct answer"}
        </dt>
        <dd className="font-medium text-[var(--correct-text)]">{item.correct ? item.given || item.expected : item.expected}</dd>
      </div>
    </dl>
  );
}

function Pill({ tone, children }: { tone?: "correct" | "incorrect"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold",
        tone === "correct" && "bg-[var(--correct-bg)] text-[var(--correct-text)]",
        tone === "incorrect" && "bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]",
        !tone && "bg-[var(--surface-2)] text-[var(--text-muted)]",
      )}
    >
      {children}
    </span>
  );
}
