"use client";

import type { TestConfig } from "@/lib/study/test";
import { BoxInput, Button, Dialog, Segmented, Switch } from "@/components/ui";

const TYPES: { key: keyof Pick<TestConfig, "trueFalse" | "multipleChoice" | "matching" | "written">; label: string }[] = [
  { key: "trueFalse", label: "True / False" },
  { key: "multipleChoice", label: "Multiple choice" },
  { key: "matching", label: "Matching" },
  { key: "written", label: "Written" },
];

/** Quizlet's "Set up your test" modal. */
export function TestSetup({
  open,
  setTitle,
  config,
  maxQuestions,
  onChange,
  onStart,
  onCancel,
}: {
  open: boolean;
  setTitle: string;
  config: TestConfig;
  maxQuestions: number;
  onChange: (next: TestConfig) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const anyType = TYPES.some((t) => config[t.key]);
  const count = Math.max(1, Math.min(maxQuestions, config.questionCount || 1));

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Set up your test"
      description={setTitle}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onStart} disabled={!anyType || maxQuestions === 0}>
            Start test
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (anyType) onStart();
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="test-count" className="text-[15px] font-bold">
            Questions
            <span className="ml-2 text-[13px] font-semibold text-[var(--text-muted)]">(max {maxQuestions})</span>
          </label>
          <BoxInput
            id="test-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQuestions}
            value={count}
            onChange={(e) => onChange({ ...config, questionCount: Number(e.target.value) })}
            onBlur={() => onChange({ ...config, questionCount: count })}
            className="w-24 text-center font-bold tabular-nums"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-bold">Answer with</span>
          <Segmented
            id="test-answer-with"
            value={config.answerWith}
            onChange={(answerWith) => onChange({ ...config, answerWith })}
            options={[
              { value: "term", label: "Term" },
              { value: "definition", label: "Definition" },
              { value: "both", label: "Both" },
            ]}
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-[15px] font-bold">Question types</legend>
          {TYPES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-4 rounded-[10px] bg-[var(--surface-2)] px-4 py-3">
              <span className="text-[15px] font-semibold">{t.label}</span>
              <Switch
                checked={config[t.key]}
                onChange={(v) => onChange({ ...config, [t.key]: v })}
                label={t.label}
              />
            </div>
          ))}
          {!anyType && (
            <p className="text-[13px] font-semibold text-[var(--incorrect-text)]">Pick at least one question type.</p>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}
