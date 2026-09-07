"use client";

import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/components/theme/ThemeProvider";
import { Segmented } from "@/components/ui";
import type { Settings } from "@/lib/db";
import { SettingRow, SettingsSection } from "../SettingRow";

export function AppearanceSection({
  update,
}: {
  update: (patch: Partial<Settings>) => Promise<void>;
}) {
  const choice = useTheme((s) => s.choice);
  const set = useTheme((s) => s.set);

  const onChange = (next: ThemeChoice) => {
    set(next); // applies immediately and persists to localStorage (pre-paint)
    void update({ theme: next }); // mirrored into the settings record for backups
  };

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      icon={<Palette />}
      description="System follows your device's light/dark setting and changes with it."
    >
      <SettingRow
        id="theme-label"
        title="Theme"
        control={
          <Segmented<ThemeChoice>
            id="theme"
            value={choice}
            onChange={onChange}
            options={[
              { value: "light", label: "Light", icon: <Sun aria-hidden className="h-4 w-4" /> },
              { value: "dark", label: "Dark", icon: <Moon aria-hidden className="h-4 w-4" /> },
              { value: "system", label: "System", icon: <Monitor aria-hidden className="h-4 w-4" /> },
            ]}
          />
        }
      />
    </SettingsSection>
  );
}
