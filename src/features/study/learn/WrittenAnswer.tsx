"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { LearnFeedback } from "@/lib/study/learn";
import { Button } from "@/components/ui";
import { riseIn } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { shake } from "../motion";

export function WrittenAnswer({
  answer,
  feedback,
  onAnswer,
  onSkip,
  onOverride,
  onContinue,
  placeholder = "Type the answer",
}: {
  answer: string;
  feedback: LearnFeedback | null;
  onAnswer: (input: string) => void;
  onSkip: () => void;
  onOverride?: () => void;
  onContinue: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const continueBtn = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  /* The parent keys this component by question, so `value` starts empty on
   * every new question; the effect only moves focus. */
  useEffect(() => {
    if (!feedback) input.current?.focus();
    else if (!feedback.correct) continueBtn.current?.focus();
  }, [feedback]);

  if (!feedback) {
    return (
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onAnswer(value);
        }}
      >
        <label htmlFor="learn-answer" className="sr-only">
          Your answer
        </label>
        <input
          ref={input}
          id="learn-answer"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            "h-14 w-full rounded-[8px] border-2 border-[var(--border)] bg-[var(--surface)] px-4 text-[18px]",
            "text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--brand)]",
          )}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Don&apos;t know
          </Button>
          <Button type="submit" disabled={!value.trim()}>
            Answer
          </Button>
        </div>
      </form>
    );
  }

  if (feedback.correct) {
    return (
      <motion.div variants={riseIn} initial="hidden" animate="show" className="mt-2" aria-live="polite">
        <AnswerBox
          tone="correct"
          label={
            feedback.overridden
              ? "Marked as correct"
              : feedback.closeButTypo
                ? "Correct — small typo, we counted it"
                : "Nice work!"
          }
          text={answer}
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={riseIn}
      className="mt-2"
      aria-live="assertive"
    >
      <motion.p animate={reduce ? undefined : shake} className="text-[18px] font-bold text-[var(--text)]">
        No worries, you&apos;re still learning!
      </motion.p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <AnswerBox tone="correct" label="Correct answer" text={answer} />
        {!feedback.skipped && <AnswerBox tone="incorrect" label="You said" text={feedback.input} />}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        {onOverride && !feedback.skipped ? (
          <button
            type="button"
            onClick={onOverride}
            className="text-[14px] font-semibold text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]"
          >
            Override: I was right
          </button>
        ) : (
          <span />
        )}
        <Button ref={continueBtn} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </motion.div>
  );
}

export function AnswerBox({ tone, label, text }: { tone: "correct" | "incorrect"; label: string; text: string }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border-2 px-4 py-3",
        tone === "correct"
          ? "border-[var(--correct)] bg-[var(--correct-bg)]"
          : "border-[var(--incorrect)] bg-[var(--incorrect-bg)]",
      )}
    >
      <p
        className={cn(
          "text-[12px] font-bold uppercase tracking-wide",
          tone === "correct" ? "text-[var(--correct-text)]" : "text-[var(--incorrect-text)]",
        )}
      >
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-[16px] font-medium text-[var(--text)]">{text || "—"}</p>
    </div>
  );
}
