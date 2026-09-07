"use client";

import { motion } from "framer-motion";
import { Check, PartyPopper, X } from "lucide-react";
import type { RoundTermResult } from "@/lib/study/learn";
import type { MasterySummary } from "@/lib/study/scheduler";
import { Button } from "@/components/ui";
import { riseIn, stagger } from "@/lib/motion/springs";
import { rowIn } from "../motion";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";
import { Confetti } from "../Confetti";
import { routes } from "../routes";
import { NavButton } from "../NavButton";
import { MasteryBars } from "./MasteryBars";

export function RoundSummary({
  round,
  score,
  summary,
  results,
  onContinue,
}: {
  round: number;
  score: { correct: number; total: number };
  summary: MasterySummary;
  results: RoundTermResult[];
  onContinue: () => void;
}) {
  const perfect = score.total > 0 && score.correct === score.total;
  return (
    <motion.section variants={stagger(0.06)} initial="hidden" animate="show" exit="exit" className="pb-28">
      <motion.header variants={riseIn}>
        <h2 className="text-[28px] leading-tight md:text-[34px]">
          {perfect ? "Perfect round — keep it up!" : "Great work, keep going!"}
        </h2>
        <p className="mt-2 text-[15px] font-semibold text-[var(--text-muted)]">
          You got {score.correct} of {score.total} right in round {round}.
        </p>
      </motion.header>

      <motion.div layoutId="learn-card" variants={riseIn} className="mt-6 rounded-[16px] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] md:p-8">
        <h3 className="mb-5 text-[18px]">Your progress</h3>
        <MasteryBars summary={summary} />
      </motion.div>

      <motion.div variants={riseIn} className="mt-6 rounded-[16px] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] md:p-8">
        <h3 className="text-[18px]">Terms studied this round</h3>
        <motion.ul variants={stagger(0.03)} className="mt-3 divide-y divide-[var(--border-soft)]">
          {results.map((r) => (
            <motion.li key={r.term.id} variants={rowIn} className="flex items-start gap-4 py-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  r.correct
                    ? "bg-[var(--correct-bg)] text-[var(--correct-text)]"
                    : "bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]",
                )}
                aria-label={r.correct ? "Correct" : "Missed"}
              >
                {r.correct ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
              </span>
              <div className="grid min-w-0 flex-1 gap-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
                <p className="text-[15px] font-semibold text-[var(--text)]">{r.term.term}</p>
                <p className="text-[15px] text-[var(--text-muted)]">{r.term.definition}</p>
              </div>
              {r.struggled && r.correct && (
                <span className="hidden shrink-0 rounded-full bg-[var(--star-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)] sm:inline">
                  Needed a retry
                </span>
              )}
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-[var(--bg-subtle)]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-[860px]">
          <Button size="lg" block onClick={onContinue} autoFocus>
            Continue
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

export function LearnComplete({
  setId,
  total,
  summary,
  onRestart,
}: {
  setId: string;
  total: number;
  summary: MasterySummary;
  onRestart: () => void;
}) {
  return (
    <motion.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      className="relative mx-auto max-w-[640px] py-6 text-center"
    >
      <Confetti />
      <motion.span
        variants={riseIn}
        className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[var(--correct-bg)] text-[var(--correct-text)]"
      >
        <PartyPopper className="h-10 w-10" aria-hidden />
      </motion.span>
      <motion.h2 variants={riseIn} className="mt-6 text-[30px] leading-tight md:text-[38px]">
        You&apos;ve mastered all {pluralize(total, "term")}!
      </motion.h2>
      <motion.p variants={riseIn} className="mt-2 text-[15px] font-semibold text-[var(--text-muted)]">
        Every term in this set is in the Mastered box. Come back later to keep it fresh.
      </motion.p>
      <motion.div variants={riseIn} className="mt-8 rounded-[16px] bg-[var(--surface)] p-6 text-left shadow-[var(--shadow-sm)]">
        <MasteryBars summary={summary} />
      </motion.div>
      <motion.div variants={riseIn} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" onClick={onRestart}>
          Study again from scratch
        </Button>
        <NavButton href={routes.set(setId)} size="lg" variant="secondary">
            Back to set
          </NavButton>
      </motion.div>
    </motion.section>
  );
}
