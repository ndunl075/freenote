"use client";

import { Check, MoveHorizontal, MoveVertical, PenLine } from "lucide-react";
import type { KeyboardEvent } from "react";
import {
  PAPER_COLOR_LABELS,
  PAPER_LABELS,
  PaperPreview,
  paperBackground,
} from "@/components/paper/PaperPreview";
import { Segmented, Switch } from "@/components/ui";
import type { PaperColor, PaperStyle, Settings } from "@/lib/db";
import { cn } from "@/lib/utils/cn";
import { SettingRow, SettingsSection } from "../SettingRow";

const PAPERS = Object.keys(PAPER_LABELS) as PaperStyle[];
const COLORS = Object.keys(PAPER_COLOR_LABELS) as PaperColor[];

export function WritingSection({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
}) {
  return (
    <SettingsSection
      id="writing"
      title="Writing"
      icon={<PenLine />}
      description="Defaults for new notes. Each note can still change its own paper."
    >
      <SettingRow
        id="stylus-only"
        title="Palm rejection"
        description="Ignore finger touches while a stylus is in range, so resting your hand on the screen never draws."
        control={
          <Switch
            checked={settings.stylusOnly}
            onChange={(v) => void update({ stylusOnly: v })}
            label="Palm rejection"
          />
        }
      />
      <SettingRow
        id="scroll-lock"
        title="Scroll direction"
        description="Which way pages flow in the editor."
        control={
          <Segmented<Settings["scrollLock"]>
            id="scroll-lock"
            value={settings.scrollLock}
            onChange={(v) => void update({ scrollLock: v })}
            options={[
              { value: "vertical", label: "Vertical", icon: <MoveVertical aria-hidden className="h-4 w-4" /> },
              { value: "horizontal", label: "Horizontal", icon: <MoveHorizontal aria-hidden className="h-4 w-4" /> },
            ]}
          />
        }
      />
      <SettingRow
        id="default-paper"
        title="Default paper"
        stacked
        control={
          <RadioGrid
            labelledBy="default-paper"
            value={settings.defaultPaper}
            options={PAPERS}
            onChange={(v) => void update({ defaultPaper: v })}
            render={(paper, selected) => (
              <>
                <span
                  className={cn(
                    "block h-[76px] w-[60px] overflow-hidden rounded-[6px] border transition-colors",
                    selected ? "border-[var(--brand)]" : "border-[var(--border)]",
                  )}
                >
                  <PaperPreview paper={paper} color={settings.defaultPaperColor} scale={0.85} />
                </span>
                <span className="mt-1.5 block text-[12px] font-bold">{PAPER_LABELS[paper]}</span>
              </>
            )}
            optionLabel={(p) => PAPER_LABELS[p]}
          />
        }
      />
      <SettingRow
        id="default-paper-color"
        title="Default paper colour"
        stacked
        control={
          <RadioGrid
            labelledBy="default-paper-color"
            value={settings.defaultPaperColor}
            options={COLORS}
            onChange={(v) => void update({ defaultPaperColor: v })}
            render={(color, selected) => (
              <>
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                    selected ? "border-[var(--brand)]" : "border-[var(--border)]",
                  )}
                  style={{ background: paperBackground(color) }}
                >
                  {selected && (
                    <Check
                      aria-hidden
                      className={cn("h-4 w-4", color === "black" ? "text-white" : "text-[var(--brand)]")}
                    />
                  )}
                </span>
                <span className="mt-1.5 block text-[12px] font-bold">{PAPER_COLOR_LABELS[color]}</span>
              </>
            )}
            optionLabel={(c) => PAPER_COLOR_LABELS[c]}
          />
        }
      />
    </SettingsSection>
  );
}

/**
 * Visual radio group: arrow keys move *and* select like native radios, so a
 * keyboard user gets the same one-gesture flow as a tap.
 */
function RadioGrid<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
  render,
  optionLabel,
}: {
  labelledBy: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  render: (option: T, selected: boolean) => React.ReactNode;
  optionLabel: (option: T) => string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.indexOf(value);
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(i + delta + options.length) % options.length];
    onChange(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className="flex flex-wrap gap-3">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={optionLabel(option)}
            data-value={option}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option)}
            className={cn(
              "flex flex-col items-center rounded-[10px] p-2 text-center transition-colors",
              selected ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]",
            )}
          >
            {render(option, selected)}
          </button>
        );
      })}
    </div>
  );
}
