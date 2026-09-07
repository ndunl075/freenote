"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  progress as progressRepo,
  type Progress,
  type Settings as AppSettings,
  type StudySet,
  type Term,
} from "@/lib/db";
import {
  allMastered,
  createLearnState,
  currentQuestion,
  dirtyProgress,
  learnReducer,
  learnSummary,
  roundProgress,
  roundResults,
  roundScore,
} from "@/lib/study/learn";
import { seedFrom } from "@/lib/study/random";
import { Button, Dialog, FullPageSpinner, IconButton, Progress as ProgressBar, Segmented } from "@/components/ui";
import { useKeydown } from "../hooks/useKeydown";
import { slideSwap } from "../motion";
import { StudyHeader, StudyScreen } from "../StudyHeader";
import { ChoiceOptions } from "./ChoiceOptions";
import { LearnComplete, RoundSummary } from "./RoundSummary";
import { WrittenAnswer } from "./WrittenAnswer";

export interface LearnProps {
  set: StudySet;
  terms: Term[];
  settings: AppSettings;
}

const CORRECT_DELAY_MS = 900;
const TYPO_DELAY_MS = 1800;

/**
 * Learn always starts from fresh progress out of IndexedDB — another mode
 * (or another tab) may have changed it since the set page loaded.
 */
export function Learn({ set, terms, settings }: LearnProps) {
  const [initial, setInitial] = useState<Progress[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    progressRepo
      .hydrate(set.id, terms.map((t) => t.id))
      .then((map) => {
        if (!cancelled) setInitial([...map.values()]);
      })
      .catch(() => {
        if (!cancelled) setInitial([]);
      });
    return () => {
      cancelled = true;
    };
  }, [set.id, terms]);

  if (!initial) return <FullPageSpinner />;
  return <LearnSession set={set} terms={terms} settings={settings} initialProgress={initial} />;
}

function LearnSession({
  set,
  terms,
  settings,
  initialProgress,
}: LearnProps & { initialProgress: Progress[] }) {
  const [state, dispatch] = useReducer(
    learnReducer,
    undefined,
    () =>
      createLearnState(terms, initialProgress, {
        seed: seedFrom(set.id) ^ (Date.now() & 0xffff),
        strictness: settings.gradingStrictness,
      }),
  );
  const [options, setOptions] = useState(false);

  const question = currentQuestion(state);
  const { done, total } = roundProgress(state);
  const summary = useMemo(() => learnSummary(state), [state]);

  /* Persist whatever changed. */
  useEffect(() => {
    if (!state.dirty.length) return;
    const records = dirtyProgress(state);
    let cancelled = false;
    progressRepo
      .save(records)
      .then(() => {
        if (!cancelled) dispatch({ type: "flushed", termIds: records.map((r) => r.termId) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dirty]);

  /* Correct answers move on by themselves, like Quizlet. */
  useEffect(() => {
    if (state.phase !== "feedback" || !state.feedback?.correct) return;
    const isChoice = state.feedback.question.kind === "choice";
    if (!isChoice && !state.feedback.closeButTypo) return; // written shows a Continue button
    const ms = state.feedback.closeButTypo ? TYPO_DELAY_MS : CORRECT_DELAY_MS;
    const id = window.setTimeout(() => dispatch({ type: "continue" }), ms);
    return () => window.clearTimeout(id);
  }, [state.phase, state.feedback]);

  useKeydown(
    (e) => {
      if (options) return;
      if (state.phase === "feedback" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        dispatch({ type: "continue" });
        return;
      }
      if (state.phase === "question" && question?.kind === "choice") {
        const n = Number(e.key);
        if (n >= 1 && n <= question.options.length) {
          e.preventDefault();
          dispatch({ type: "answer", input: question.options[n - 1] });
        }
      }
      if (state.phase === "round-summary" && e.key === "Enter") {
        dispatch({ type: "next-round" });
      }
    },
    { inInputs: true },
  );

  const answerSideLabel = state.settings.answerWith === "term" ? "term" : "definition";

  return (
    <StudyScreen>
      <StudyHeader
        mode="learn"
        setId={set.id}
        title={set.title}
        center={
          <div className="flex items-center justify-center gap-3 text-[15px] font-bold">
            <span className="text-[var(--text-muted)]">Round {state.round}</span>
            {state.phase !== "complete" && (
              <span className="tabular-nums text-[var(--text)]" aria-live="polite">
                {done} / {total}
              </span>
            )}
          </div>
        }
        right={
          <IconButton label="Options" onClick={() => setOptions(true)}>
            <Settings />
          </IconButton>
        }
      />
      <div className="px-3 md:px-6">
        <ProgressBar value={done} max={Math.max(1, total)} height={4} />
      </div>

      <main className="mx-auto w-full max-w-[860px] flex-1 px-3 pb-10 pt-6 md:px-6 md:pt-10">
        <AnimatePresence mode="wait" initial={false}>
          {state.phase === "complete" ? (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LearnComplete
                setId={set.id}
                total={state.terms.length}
                summary={summary}
                onRestart={() => dispatch({ type: "reset" })}
              />
            </motion.div>
          ) : state.phase === "round-summary" ? (
            <RoundSummary
              key={`summary-${state.round}`}
              round={state.round}
              score={roundScore(state)}
              summary={summary}
              results={roundResults(state)}
              onContinue={() => dispatch({ type: "next-round" })}
            />
          ) : question ? (
            <motion.section
              key={question.id}
              layoutId="learn-card"
              variants={slideSwap}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex min-h-[440px] flex-col rounded-[16px] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] md:p-10"
              aria-labelledby="learn-prompt"
            >
              <header className="flex items-center justify-between text-[13px] font-semibold text-[var(--text-muted)]">
                <span>{question.promptSide === "term" ? "Term" : "Definition"}</span>
                <span className="tabular-nums">
                  {question.kind === "written" ? "Written" : "Multiple choice"}
                </span>
              </header>
              <p
                id="learn-prompt"
                className="mt-5 flex-1 whitespace-pre-wrap break-words text-[20px] leading-snug text-[var(--text)] md:text-[26px]"
              >
                {question.prompt}
              </p>

              <div className="mt-8">
                {question.kind === "choice" ? (
                  <>
                    <ChoiceOptions
                      options={question.options}
                      answer={question.answer}
                      feedback={state.feedback}
                      label={`Choose the matching ${answerSideLabel}`}
                      onChoose={(option) => dispatch({ type: "answer", input: option })}
                    />
                    {state.feedback && !state.feedback.correct && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-5 flex items-center justify-between gap-3"
                      >
                        <span className="text-[13px] font-semibold text-[var(--text-muted)]">
                          Press Enter to continue
                        </span>
                        <Button onClick={() => dispatch({ type: "continue" })} autoFocus>
                          Continue
                        </Button>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <WrittenAnswer
                    answer={question.answer}
                    feedback={state.feedback}
                    placeholder={`Type the ${answerSideLabel}`}
                    onAnswer={(input) => dispatch({ type: "answer", input })}
                    onSkip={() => dispatch({ type: "skip" })}
                    onOverride={() => dispatch({ type: "override" })}
                    onContinue={() => dispatch({ type: "continue" })}
                  />
                )}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>

      <Dialog open={options} onClose={() => setOptions(false)} title="Options" width="sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-bold">Answer with</p>
              <p className="text-[13px] text-[var(--text-muted)]">Changing this restarts the round</p>
            </div>
            <Segmented
              id="learn-answer-with"
              value={state.settings.answerWith}
              onChange={(answerWith) => dispatch({ type: "set-answer-with", answerWith })}
              options={[
                { value: "term", label: "Term" },
                { value: "definition", label: "Definition" },
              ]}
            />
          </div>
          <div className="rounded-[12px] bg-[var(--surface-2)] p-4 text-[13px] text-[var(--text-muted)]">
            <p className="font-bold text-[var(--text)]">Progress</p>
            <p className="mt-1">
              {summary.mastered} mastered · {summary.learning} still learning · {summary.notStarted} not started
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "restart" });
                setOptions(false);
              }}
            >
              Restart round
            </Button>
            <Button
              variant="ghost"
              disabled={allMastered(state) && state.phase === "complete"}
              onClick={() => {
                dispatch({ type: "reset" });
                setOptions(false);
              }}
              className="text-[var(--incorrect-text)]"
            >
              Reset progress for this set
            </Button>
          </div>
        </div>
      </Dialog>
    </StudyScreen>
  );
}
