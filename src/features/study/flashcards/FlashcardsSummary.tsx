"use client";

import { motion } from "framer-motion";
import { Button, ProgressRing } from "@/components/ui";
import { riseIn, spring, stagger } from "@/lib/motion/springs";
import { pluralize } from "@/lib/utils/format";
import { Confetti } from "../Confetti";
import { routes } from "../routes";
import { NavButton } from "../NavButton";

export function FlashcardsSummary({
  setId,
  total,
  know,
  learning,
  sorting,
  onReview,
  onRestart,
}: {
  setId: string;
  total: number;
  know: number;
  learning: number;
  sorting: boolean;
  onReview: () => void;
  onRestart: () => void;
}) {
  const pct = total ? Math.round((know / total) * 100) : 0;
  const perfect = sorting && total > 0 && know === total;

  return (
    <motion.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      className="relative mx-auto w-full max-w-[760px] py-8 md:py-12"
      aria-live="polite"
    >
      {perfect && <Confetti />}
      <motion.h2 variants={riseIn} className="text-[28px] leading-tight md:text-[36px]">
        {perfect
          ? "You know it all — nice work!"
          : sorting
            ? "Nice work! You're making progress."
            : `You've reviewed all ${pluralize(total, "card")}.`}
      </motion.h2>

      {sorting && (
        <motion.div
          variants={riseIn}
          className="mt-8 grid items-center gap-8 rounded-[16px] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] md:grid-cols-[auto_1fr] md:p-8"
        >
          <ProgressRing value={know} max={total} size={140} stroke={12} tone="correct">
            <span className="text-[30px] font-extrabold tabular-nums">{pct}%</span>
          </ProgressRing>
          <div className="flex flex-col gap-3">
            <PileStat label="Know" count={know} tone="correct" layoutId="pile-know" />
            <PileStat label="Still learning" count={learning} tone="incorrect" layoutId="pile-learning" />
          </div>
        </motion.div>
      )}

      <motion.h3 variants={riseIn} className="mt-10 text-[18px]">
        Next steps
      </motion.h3>
      <motion.div variants={riseIn} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {sorting && learning > 0 && (
          <Button size="lg" onClick={onReview}>
            Keep reviewing {pluralize(learning, "term")}
          </Button>
        )}
        <Button size="lg" variant={sorting && learning > 0 ? "secondary" : "primary"} onClick={onRestart}>
          Restart Flashcards
        </Button>
        <NavButton href={routes.set(setId)} size="lg" variant="ghost">
            Back to set
          </NavButton>
      </motion.div>
    </motion.section>
  );
}

function PileStat({
  label,
  count,
  tone,
  layoutId,
}: {
  label: string;
  count: number;
  tone: "correct" | "incorrect";
  layoutId: string;
}) {
  const color = tone === "correct" ? "var(--correct-text)" : "var(--incorrect-text)";
  const bg = tone === "correct" ? "var(--correct-bg)" : "var(--incorrect-bg)";
  return (
    <div className="flex items-center justify-between gap-4 rounded-[12px] px-5 py-3" style={{ background: bg }}>
      <span className="text-[16px] font-bold" style={{ color }}>
        {label}
      </span>
      <motion.span
        layoutId={layoutId}
        transition={spring.soft}
        className="inline-flex min-w-[44px] items-center justify-center rounded-full border-2 bg-[var(--surface)] px-3 py-1 text-[16px] font-extrabold tabular-nums"
        style={{ borderColor: color, color }}
      >
        {count}
      </motion.span>
    </div>
  );
}
