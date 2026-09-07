"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { spring } from "@/lib/motion/springs";

export function Progress({
  value,
  max = 100,
  tone = "brand",
  className,
  height = 8,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "correct" | "star";
  className?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill =
    tone === "correct"
      ? "var(--correct)"
      : tone === "star"
        ? "var(--star)"
        : "var(--brand)";

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("w-full overflow-hidden rounded-full bg-[var(--track)]", className)}
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: fill }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={spring.soft}
      />
    </div>
  );
}

/** Circular ring used on the Learn round summary. */
export function ProgressRing({
  value,
  max = 100,
  size = 88,
  stroke = 8,
  tone = "brand",
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: "brand" | "correct";
  children?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === "correct" ? "var(--correct)" : "var(--brand)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ ...spring.soft, delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
