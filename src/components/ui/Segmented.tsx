"use client";

import { motion } from "framer-motion";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/** Sliding pill selector — the shared layoutId gives it Quizlet's glide. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  id = "segmented",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  id?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-1",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-2 rounded-full px-4 py-2",
              "text-[14px] font-bold transition-colors duration-150",
              selected ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={spring.snap}
                className="absolute inset-0 -z-10 rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]"
              />
            )}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
