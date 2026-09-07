"use client";

import { motion } from "framer-motion";
import { Download, Mic, NotebookPen, Layers } from "lucide-react";
import { riseIn, stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

/**
 * The landing hero: a heading, a quote, and three quick actions.
 *
 * Notability opens on exactly this — the three things you are most likely to
 * want, as chunky tinted tiles, rather than an empty grid and a "+" you have to
 * find. Each tile pairs a pastel wash with a border a few steps darker; the
 * border is what stops them reading as flat blocks of colour.
 */

const QUOTES: { text: string; who: string }[] = [
  { text: "In the middle of difficulty lies opportunity.", who: "Albert Einstein" },
  { text: "The expert in anything was once a beginner.", who: "Helen Hayes" },
  { text: "It always seems impossible until it's done.", who: "Nelson Mandela" },
  { text: "The beautiful thing about learning is nobody can take it away from you.", who: "B.B. King" },
  { text: "Study without desire spoils the memory.", who: "Leonardo da Vinci" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", who: "Benjamin Franklin" },
  { text: "The mind is not a vessel to be filled but a fire to be kindled.", who: "Plutarch" },
];

type Tint = "blue" | "amber" | "indigo";

const TINTS: Record<Tint, string> = {
  blue: "bg-[var(--tint-blue)] border-[var(--tint-blue-line)] text-[var(--tint-blue-ink)]",
  amber: "bg-[var(--tint-amber)] border-[var(--tint-amber-line)] text-[var(--tint-amber-ink)]",
  indigo: "bg-[var(--tint-indigo)] border-[var(--tint-indigo-line)] text-[var(--tint-indigo-ink)]",
};

export function HomeHero({
  seed,
  onNewNote,
  onRecord,
  onNewSet,
  onImport,
}: {
  /** Rotates the quote. Derived from library size rather than a clock: reading
   *  the time during render is impure, and this changes as you use the app. */
  seed: number;
  onNewNote: () => void;
  onRecord: () => void;
  onNewSet: () => void;
  onImport: () => void;
}) {
  const quote = QUOTES[Math.abs(seed) % QUOTES.length];

  const actions: { label: string; sub: string; icon: React.ReactNode; tint: Tint; run: () => void }[] = [
    { label: "New", sub: "handwritten note", icon: <NotebookPen />, tint: "blue", run: onNewNote },
    { label: "Record", sub: "a lecture", icon: <Mic />, tint: "amber", run: onRecord },
    { label: "New", sub: "study set", icon: <Layers />, tint: "indigo", run: onNewSet },
  ];

  return (
    <motion.section
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-[680px] pb-8 pt-2 text-center"
      aria-label="Get started"
    >
      <motion.div variants={riseIn} className="flex justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--brand-soft)] text-[var(--brand)]">
          <NotebookPen className="h-6 w-6" aria-hidden />
        </span>
      </motion.div>

      <motion.h1 variants={riseIn} className="mt-3 text-[26px] leading-[1.15]">
        Let&rsquo;s get started
      </motion.h1>

      <motion.p variants={riseIn} className="mx-auto mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-[var(--text-muted)]">
        &ldquo;{quote.text}&rdquo; &mdash; {quote.who}
      </motion.p>

      <motion.div
        variants={riseIn}
        className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      >
        {actions.map((a) => (
          <button
            key={a.sub}
            onClick={a.run}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-[13px] border px-3 py-4",
              "transition-transform duration-150 hover:-translate-y-[2px] active:translate-y-0",
              TINTS[a.tint],
            )}
          >
            <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden>
              {a.icon}
            </span>
            <span className="text-[13.5px] font-extrabold leading-tight tracking-[-0.02em]">
              {a.label}
              <br />
              {a.sub}
            </span>
          </button>
        ))}
      </motion.div>

      <motion.button
        variants={riseIn}
        onClick={onImport}
        className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--brand)]"
      >
        <Download className="h-4 w-4" aria-hidden />
        Restore from a backup
      </motion.button>
    </motion.section>
  );
}
