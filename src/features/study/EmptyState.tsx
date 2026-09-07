"use client";

import { motion } from "framer-motion";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { riseIn } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  Icon,
  title,
  description,
  actions,
  className,
}: {
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={riseIn}
      initial="hidden"
      animate="show"
      className={cn("mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center", className)}
    >
      {Icon && (
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon className="h-8 w-8" aria-hidden />
        </span>
      )}
      <h2 className="text-[24px] leading-tight">{title}</h2>
      {description && <p className="mt-2 text-[15px] text-[var(--text-muted)]">{description}</p>}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </motion.section>
  );
}
