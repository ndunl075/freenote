"use client";

import { GraduationCap } from "lucide-react";
import { Segmented, Switch } from "@/components/ui";
import type { Settings } from "@/lib/db";
import { SettingRow, SettingsSection } from "../SettingRow";

const MIN_SECONDS = 1;
const MAX_SECONDS = 15;

export function StudyingSection({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
}) {
  return (
    <SettingsSection
      id="studying"
      title="Studying"
      icon={<GraduationCap />}
      description="Applies to every study set. Progress is tracked per set, on this device."
    >
      <SettingRow
        id="autoplay"
        title="Flashcards autoplay"
        description="How long each side stays up before the card flips or advances on its own."
        control={
          <label className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_SECONDS}
              max={MAX_SECONDS}
              step={1}
              value={settings.autoplaySeconds}
              onChange={(e) => void update({ autoplaySeconds: Number(e.target.value) })}
              aria-labelledby="autoplay"
              aria-valuetext={`${settings.autoplaySeconds} seconds per side`}
              className="h-2 w-[160px] cursor-pointer"
              style={{ accentColor: "var(--brand)" }}
            />
            <span className="w-[68px] text-right text-[14px] font-bold tabular-nums">
              {settings.autoplaySeconds}s / side
            </span>
          </label>
        }
      />
      <SettingRow
        id="grading"
        title="Written answer grading"
        description="Lenient forgives typos, accents, punctuation and case. Strict wants an exact match."
        control={
          <Segmented<Settings["gradingStrictness"]>
            id="grading"
            value={settings.gradingStrictness}
            onChange={(v) => void update({ gradingStrictness: v })}
            options={[
              { value: "lenient", label: "Lenient" },
              { value: "strict", label: "Strict" },
            ]}
          />
        }
      />
      <SettingRow
        id="sound"
        title="Sounds"
        description="Correct/incorrect chimes in Learn and Test, and the Match timer tick."
        control={
          <Switch
            checked={settings.soundEnabled}
            onChange={(v) => void update({ soundEnabled: v })}
            label="Sounds"
          />
        }
      />
    </SettingsSection>
  );
}
