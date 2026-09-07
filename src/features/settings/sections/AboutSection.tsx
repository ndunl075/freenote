"use client";

import { ExternalLink, Info } from "lucide-react";
import Image from "next/image";
import pkg from "../../../../package.json";
import { SettingsSection } from "../SettingRow";

const REPO = "https://github.com/ndunl075/freenote";

export function AboutSection() {
  return (
    <SettingsSection id="about" title="About" icon={<Info />}>
      <div className="flex flex-col gap-5 py-5 sm:flex-row sm:items-start">
        <Image src="/icon.svg" alt="" width={56} height={56} className="shrink-0 rounded-[14px]" />
        <div className="min-w-0 text-[14px] leading-relaxed text-[var(--text-muted)]">
          <p>
            <strong className="text-[var(--text)]">freenote</strong> is an open-source notebook and
            flashcard app. Handwrite or type, record audio that stays in sync with your ink, then
            turn your notes into study sets and drill them with Flashcards, Learn, Test, Match and
            Blast.
          </p>
          <p className="mt-3">
            Everything stays on this device. There is no account, no server and no analytics — the
            app is a static bundle and your notes live in this browser&apos;s storage. Use{" "}
            <strong className="text-[var(--text)]">Export backup</strong> above to move them or to
            keep a copy.
          </p>
          <p className="mt-3">
            Released under the MIT licence. Version {pkg.version}.
          </p>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1.5 rounded-[8px] font-bold text-[var(--brand)] hover:underline"
          >
            Source on GitHub
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </SettingsSection>
  );
}
