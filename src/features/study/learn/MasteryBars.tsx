"use client";

import { motion } from "framer-motion";
import type { MasterySummary } from "@/lib/study/scheduler";
import { spring } from "@/lib/motion/springs";

const ROWS: { key: keyof Omit<MasterySummary, "total">; label: string; color: string }[] = [
  { key: "notStarted", label: "Not started", color: "var(--text-faint)" },
  { key: "learning", label: "Still learning", color: "var(--incorrect)" },
  { key: "mastered", label: "Mastered", color: "var(--correct)" },
];

/** The three horizontal bars on Learn's round summary. */
export function MasteryBars({ summary }: { summary: MasterySummary }) {
  return (
    <dl className="flex flex-col gap-4">
      {ROWS.map((row, i) => {
        const count = summary[row.key];
        const pct = summary.total ? (count / summary.total) * 100 : 0;
        return (
          <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
            <dt className="text-[15px] font-bold text-[var(--text)]">{row.label}</dt>
            <dd className="text-[15px] font-semibold tabular-nums text-[var(--text)]">{count}</dd>
            <dd className="col-span-2 h-3 overflow-hidden rounded-full bg-[var(--track)]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: row.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ ...spring.soft, delay: 0.1 + i * 0.08 }}
                role="progressbar"
                aria-label={row.label}
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={summary.total}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
