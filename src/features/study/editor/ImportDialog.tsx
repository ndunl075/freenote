"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_IMPORT_OPTIONS,
  guessTermSeparator,
  parseImport,
  type ImportOptions,
  type RowSeparator,
  type TermSeparator,
} from "@/lib/study/import";
import { Button, Dialog, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";

const PLACEHOLDER = "Word 1\tDefinition 1\nWord 2\tDefinition 2\nWord 3\tDefinition 3";

/** Quizlet's "Import your data" dialog: paste, pick separators, preview, import. */
export function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: { term: string; definition: string }[]) => void;
}) {
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [touched, setTouched] = useState(false);

  /* Every way out (Cancel, Escape, overlay, Import) starts the next open fresh. */
  const close = () => {
    setText("");
    setOpts(DEFAULT_IMPORT_OPTIONS);
    setTouched(false);
    onClose();
  };

  const rows = useMemo(() => parseImport(text, opts), [text, opts]);

  const onPaste = (value: string) => {
    setText(value);
    if (!touched) setOpts((o) => ({ ...o, termSeparator: guessTermSeparator(value) }));
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Import your data"
      description="Copy and paste your data here (from Word, Excel, Google Docs, etc.)"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!rows.length}
            onClick={() => {
              onImport(rows);
              close();
            }}
          >
            Import {rows.length ? pluralize(rows.length, "card") : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor="import-text" className="sr-only">
            Data to import
          </label>
          <Textarea
            id="import-text"
            rows={7}
            value={text}
            onChange={(e) => onPaste(e.target.value)}
            placeholder={PLACEHOLDER}
            className="font-mono text-[14px] leading-relaxed"
            autoFocus
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SeparatorPicker<TermSeparator>
            legend="Between term and definition"
            value={opts.termSeparator}
            options={[
              { value: "tab", label: "Tab" },
              { value: "comma", label: "Comma" },
              { value: "custom", label: "Custom" },
            ]}
            custom={opts.customTermSeparator}
            onChange={(termSeparator) => {
              setTouched(true);
              setOpts((o) => ({ ...o, termSeparator }));
            }}
            onCustom={(customTermSeparator) => setOpts((o) => ({ ...o, customTermSeparator, termSeparator: "custom" }))}
            customPlaceholder="e.g. -"
          />
          <SeparatorPicker<RowSeparator>
            legend="Between cards"
            value={opts.rowSeparator}
            options={[
              { value: "newline", label: "New line" },
              { value: "semicolon", label: "Semicolon" },
              { value: "custom", label: "Custom" },
            ]}
            custom={opts.customRowSeparator}
            onChange={(rowSeparator) => setOpts((o) => ({ ...o, rowSeparator }))}
            onCustom={(customRowSeparator) => setOpts((o) => ({ ...o, customRowSeparator, rowSeparator: "custom" }))}
            customPlaceholder="e.g. \n\n"
          />
        </div>

        <section aria-live="polite">
          <h3 className="text-[15px] font-bold">
            Preview{" "}
            <span className="text-[13px] font-semibold text-[var(--text-muted)]">
              {text.trim() ? pluralize(rows.length, "card") : "Paste to see a preview"}
            </span>
          </h3>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-[8px] border border-[var(--border-soft)] bg-[var(--surface-2)]">
            {rows.length ? (
              <ol className="divide-y divide-[var(--border-soft)]">
                {rows.slice(0, 50).map((r, i) => (
                  <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-2 text-[14px]">
                    <span className="tabular-nums text-[var(--text-faint)]">{i + 1}</span>
                    <span className="break-words font-medium">{r.term || <em className="text-[var(--text-faint)]">empty</em>}</span>
                    <span className="break-words text-[var(--text-muted)]">
                      {r.definition || <em className="text-[var(--text-faint)]">empty</em>}
                    </span>
                  </li>
                ))}
                {rows.length > 50 && (
                  <li className="px-3 py-2 text-[13px] text-[var(--text-faint)]">…and {rows.length - 50} more</li>
                )}
              </ol>
            ) : (
              <p className="px-3 py-6 text-center text-[13px] text-[var(--text-faint)]">Nothing to show yet.</p>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

function SeparatorPicker<T extends string>({
  legend,
  value,
  options,
  custom,
  onChange,
  onCustom,
  customPlaceholder,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  custom: string;
  onChange: (v: T) => void;
  onCustom: (v: string) => void;
  customPlaceholder: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{legend}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] font-semibold transition-colors",
                selected
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
              )}
            >
              <input
                type="radio"
                name={legend}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
        {value === "custom" && (
          <input
            aria-label={`${legend} custom separator`}
            value={custom}
            onChange={(e) => onCustom(e.target.value)}
            placeholder={customPlaceholder}
            className="h-9 w-24 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 font-mono text-[14px] outline-none focus:border-[var(--brand)]"
          />
        )}
      </div>
    </fieldset>
  );
}
