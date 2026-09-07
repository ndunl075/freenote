"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { overlayFade, spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[760px]" };

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={overlayFade}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: spring.snap }}
            exit={{ opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.12 } }}
            className={cn(
              "relative w-full rounded-[16px] bg-[var(--surface)] p-6",
              "shadow-[var(--shadow-xl)]",
              widths[width],
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {title && <h2 className="text-[22px] leading-tight">{title}</h2>}
                {description && (
                  <p className="mt-1 text-[14px] text-[var(--text-muted)]">{description}</p>
                )}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
                <X />
              </IconButton>
            </div>
            {children && <div className="mt-5">{children}</div>}
            {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
