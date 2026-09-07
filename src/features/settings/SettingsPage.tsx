"use client";

import { motion } from "framer-motion";
import { AppShell } from "@/components/shell/AppShell";
import { stagger } from "@/lib/motion/springs";
import { AboutSection } from "./sections/AboutSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { DataSection } from "./sections/DataSection";
import { StudyingSection } from "./sections/StudyingSection";
import { WritingSection } from "./sections/WritingSection";
import { useSettings } from "./useSettings";

const JUMP = [
  { id: "appearance", label: "Appearance" },
  { id: "writing", label: "Writing" },
  { id: "studying", label: "Studying" },
  { id: "data", label: "Your data" },
  { id: "about", label: "About" },
];

export function SettingsPage() {
  const { settings, update, reload } = useSettings();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-6 sm:px-6">
        <h1 className="text-[28px] sm:text-[32px]">Settings</h1>
        <nav aria-label="Settings sections" className="mt-3 flex flex-wrap gap-2">
          {JUMP.map((j) => (
            <a
              key={j.id}
              href={`#${j.id}`}
              className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[13px] font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
            >
              {j.label}
            </a>
          ))}
        </nav>

        {settings ? (
          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            animate="show"
            className="mt-6 flex flex-col gap-5"
          >
            <AppearanceSection update={update} />
            <WritingSection settings={settings} update={update} />
            <StudyingSection settings={settings} update={update} />
            <DataSection onWiped={reload} />
            <AboutSection />
          </motion.div>
        ) : (
          <div role="status" aria-label="Loading settings" className="mt-6 flex flex-col gap-5">
            {JUMP.map((j, i) => (
              <div
                key={j.id}
                className="h-40 animate-pulse rounded-[16px] border border-[var(--border-soft)] bg-[var(--surface-2)]"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
