"use client";

import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { spring } from "@/lib/motion/springs";
import { newId } from "@/lib/utils/id";

type Tone = "default" | "success" | "error";
interface Toast {
  id: string;
  message: string;
  tone: Tone;
  action?: { label: string; run: () => void };
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, opts?: { tone?: Tone; action?: Toast["action"] }) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, opts) => {
    const id = newId();
    set((s) => ({
      toasts: [...s.toasts, { id, message, tone: opts?.tone ?? "default", action: opts?.action }],
    }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  show: (m: string) => useToasts.getState().push(m),
  success: (m: string) => useToasts.getState().push(m, { tone: "success" }),
  error: (m: string) => useToasts.getState().push(m, { tone: "error" }),
  withAction: (m: string, label: string, run: () => void) =>
    useToasts.getState().push(m, { action: { label, run } }),
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snap }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.14 } }}
            className="pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3 text-[14px] font-semibold shadow-[var(--shadow-lg)]"
            style={{
              background:
                t.tone === "success"
                  ? "var(--correct-text)"
                  : t.tone === "error"
                    ? "var(--incorrect-text)"
                    : "var(--inverse-surface)",
              color: "#fff",
            }}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
                className="font-bold underline underline-offset-2 opacity-90 hover:opacity-100"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
