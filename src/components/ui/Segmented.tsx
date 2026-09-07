"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Sliding pill selector — the shared layoutId lets the thumb glide between
 * segments rather than cutting.
 *
 * Exposed as a radiogroup rather than a tablist. Every use of this control
 * picks one value from a set (theme, view mode, sort order); none of them
 * switch a tab panel, and announcing "tab" promises a panel that isn't there.
 * Radiogroup semantics also bring the arrow-key behaviour people expect.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  id = "segmented",
  label,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  id?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const index = options.findIndex((o) => o.value === value);
    if (index === -1) return;
    // Wrap, as a radiogroup does.
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.value);
    // Selection follows focus here, so move focus with it.
    requestAnimationFrame(() => {
      ref.current
        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
        [options.indexOf(next)]?.focus();
    });
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-2)] p-[3px]",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            // Roving tabindex: the group is one tab stop, arrows move within it.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
              "text-[13px] font-semibold transition-colors duration-150",
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
