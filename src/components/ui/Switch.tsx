"use client";

import { motion } from "framer-motion";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full p-[3px] transition-colors duration-200",
        checked ? "bg-[var(--brand)]" : "bg-[var(--border)]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <motion.span
        layout
        transition={spring.snap}
        className="block h-[22px] w-[22px] rounded-full bg-white shadow-[var(--shadow-sm)]"
        style={{ marginLeft: checked ? 20 : 0 }}
      />
    </button>
  );
}
