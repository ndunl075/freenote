"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { sameAnswer } from "@/lib/study/grading";
import type { LearnFeedback } from "@/lib/study/learn";
import { stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { pop, rowIn, shake } from "../motion";

type Tone = "idle" | "correct" | "wrong" | "dim";

export function ChoiceOptions({
  options,
  answer,
  feedback,
  onChoose,
  label,
}: {
  options: string[];
  answer: string;
  feedback: LearnFeedback | null;
  onChoose: (option: string) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  const locked = !!feedback;

  return (
    <div>
      <p
        className={cn(
          "mb-3 text-[14px] font-bold",
          feedback ? (feedback.correct ? "text-[var(--correct-text)]" : "text-[var(--incorrect-text)]") : "text-[var(--text-muted)]",
        )}
        aria-live="polite"
      >
        {feedback ? (feedback.correct ? "Nice work!" : "No worries, you're still learning!") : label}
      </p>
      <motion.div
        role="group"
        aria-label="Answer choices"
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-2"
      >
        {options.map((option, i) => {
          const isAnswer = sameAnswer(option, answer);
          const chosen = !!feedback && sameAnswer(feedback.input, option);
          const tone: Tone = !feedback ? "idle" : isAnswer ? "correct" : chosen ? "wrong" : "dim";
          return (
            <motion.div key={option + i} variants={rowIn}>
              <motion.button
                type="button"
                animate={reduce ? undefined : tone === "wrong" ? shake : tone === "correct" ? pop : { x: 0, scale: 1 }}
                disabled={locked}
                onClick={() => onChoose(option)}
                aria-label={`Option ${i + 1}: ${option}`}
                className={cn(
                  "flex min-h-[64px] w-full items-center gap-3 rounded-[8px] border px-4 py-3 text-left text-[16px] font-medium",
                  "transition-colors duration-150",
                  tone === "idle" &&
                    "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
                  tone === "correct" && "border-[var(--correct)] bg-[var(--correct-bg)] text-[var(--correct-text)]",
                  tone === "wrong" && "border-[var(--incorrect)] bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]",
                  tone === "dim" && "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-faint)]",
                  "disabled:cursor-default",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold",
                    tone === "correct"
                      ? "border-[var(--correct)] bg-[var(--correct)] text-[var(--brand-ink)]"
                      : tone === "wrong"
                        ? "border-[var(--incorrect)] bg-[var(--incorrect)] text-[var(--brand-ink)]"
                        : "border-[var(--border)] text-[var(--text-muted)]",
                  )}
                  aria-hidden
                >
                  {tone === "correct" ? <Check className="h-4 w-4" strokeWidth={3} /> : tone === "wrong" ? <X className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="whitespace-pre-wrap break-words">{option}</span>
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
