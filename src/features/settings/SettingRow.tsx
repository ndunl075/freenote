"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { riseIn } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

/** A titled card grouping related settings. */
export function SettingsSection({
  id,
  title,
  description,
  icon,
  children,
  tone = "default",
}: {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <motion.section
      id={id}
      aria-labelledby={`${id}-heading`}
      variants={riseIn}
      className={cn(
        "scroll-mt-20 rounded-[16px] border bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        tone === "danger" ? "border-[var(--incorrect-bg)]" : "border-[var(--border-soft)]",
      )}
    >
      <header className="flex items-start gap-3 border-b border-[var(--border-soft)] px-5 py-4">
        {icon && (
          <span
            aria-hidden
            className={cn(
              "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4",
              tone === "danger"
                ? "bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]"
                : "bg-[var(--brand-soft)] text-[var(--brand)]",
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-[18px] leading-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{description}</p>
          )}
        </div>
      </header>
      <div className="px-5">{children}</div>
    </motion.section>
  );
}

/**
 * One setting: a title and explanation on the left, its control on the
 * right. Stacks vertically on narrow screens and for wide controls.
 */
export function SettingRow({
  id,
  title,
  description,
  control,
  stacked,
}: {
  /** Id for the title element so controls can point at it with aria-labelledby. */
  id: string;
  title: string;
  description?: ReactNode;
  control: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 border-b border-[var(--border-soft)] py-4 last:border-b-0",
        stacked ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0">
        <div id={id} className="text-[15px] font-bold">
          {title}
        </div>
        {description && (
          <p className="mt-0.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
      <div className={cn("shrink-0", !stacked && "sm:pl-6")}>{control}</div>
    </div>
  );
}
