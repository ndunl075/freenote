"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { Settings as AppSettings, StudySet, Term } from "@/lib/db";
import { seedFrom } from "@/lib/study/random";
import {
  answeredCount,
  DEFAULT_TEST_CONFIG,
  generateSeededTest,
  gradeTest,
  isAnswered,
  type TestAnswers,
  type TestAnswerValue,
  type TestConfig,
  type TestExam,
  type TestReport,
} from "@/lib/study/test";
import { Button, Dialog } from "@/components/ui";
import { screenSwap } from "../motion";
import { routes } from "../routes";
import { StudyHeader, StudyScreen } from "../StudyHeader";
import { TestExamView } from "./TestExam";
import { TestResults } from "./TestResults";
import { TestSetup } from "./TestSetup";

type Stage = "setup" | "exam" | "results";

export interface TestModeProps {
  set: StudySet;
  terms: Term[];
  settings: AppSettings;
}

export function TestMode({ set, terms, settings }: TestModeProps) {
  const router = useRouter();
  const usable = useMemo(() => terms.filter((t) => t.term.trim() && t.definition.trim()), [terms]);
  const max = usable.length;

  const [config, setConfig] = useState<TestConfig>({
    ...DEFAULT_TEST_CONFIG,
    questionCount: Math.min(DEFAULT_TEST_CONFIG.questionCount, max),
  });
  const [stage, setStage] = useState<Stage>("setup");
  const [exam, setExam] = useState<TestExam | null>(null);
  const [answers, setAnswers] = useState<TestAnswers>({});
  const [report, setReport] = useState<TestReport | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const start = useCallback(() => {
    const seed = seedFrom(set.id) ^ Date.now();
    setExam(generateSeededTest(usable, { ...config, questionCount: Math.max(1, Math.min(max, config.questionCount)) }, seed));
    setAnswers({});
    setReport(null);
    setStartedAt(Date.now());
    setStage("exam");
    window.scrollTo({ top: 0 });
  }, [set.id, usable, config, max]);

  const finish = useCallback(() => {
    if (!exam) return;
    setReport(gradeTest(exam, answers, settings.gradingStrictness));
    setElapsed(Date.now() - startedAt);
    setStage("results");
    setConfirm(false);
    window.scrollTo({ top: 0 });
  }, [exam, answers, settings.gradingStrictness, startedAt]);

  const answered = exam ? answeredCount(exam, answers) : 0;

  const submit = () => {
    if (!exam) return;
    if (answered < exam.total) setConfirm(true);
    else finish();
  };

  const jumpToFirstUnanswered = () => {
    setConfirm(false);
    if (!exam) return;
    const first = exam.questions.find((q) => !isAnswered(q, answers[q.id]));
    if (first) document.getElementById(`question-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onAnswer = (id: string, value: TestAnswerValue) => setAnswers((prev) => ({ ...prev, [id]: value }));

  return (
    <StudyScreen>
      <StudyHeader
        mode="test"
        setId={set.id}
        title={set.title}
        center={
          stage === "exam" && exam ? (
            <p className="text-[15px] font-bold tabular-nums" aria-live="polite">
              {answered} / {exam.total}
            </p>
          ) : undefined
        }
      />

      <main className="mx-auto w-full max-w-[860px] flex-1 px-3 pb-10 pt-6 md:px-6 md:pt-8">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "exam" && exam && (
            <motion.div key="exam" variants={screenSwap} initial="hidden" animate="show" exit="exit">
              <TestExamView exam={exam} answers={answers} onAnswer={onAnswer} onSubmit={submit} answered={answered} />
            </motion.div>
          )}
          {stage === "results" && exam && report && (
            <motion.div key="results" variants={screenSwap} initial="hidden" animate="show" exit="exit">
              <TestResults setId={set.id} exam={exam} report={report} elapsedMs={elapsed} onRetake={() => setStage("setup")} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <TestSetup
        open={stage === "setup"}
        setTitle={set.title}
        config={config}
        maxQuestions={max}
        onChange={setConfig}
        onStart={start}
        onCancel={() => (exam ? setStage("results") : router.push(routes.set(set.id)))}
      />

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit unfinished test?"
        description={exam ? `You haven't answered ${exam.total - answered} of ${exam.total} questions. Unanswered questions count as incorrect.` : undefined}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={jumpToFirstUnanswered}>
              Keep going
            </Button>
            <Button onClick={finish}>Submit anyway</Button>
          </>
        }
      />
    </StudyScreen>
  );
}
