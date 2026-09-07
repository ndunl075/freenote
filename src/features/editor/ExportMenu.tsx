"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, FileImage, FileText, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton, toast } from "@/components/ui";
import { downloadBackup } from "@/lib/io/backup";
import {
  downloadBlob,
  exportNotePdf,
  exportPagePng,
  safeFilename,
} from "@/lib/io/exportNote";
import { spring } from "@/lib/motion/springs";
import { useEditor } from "./store";

export function ExportMenu() {
  const note = useEditor((s) => s.note);
  const pages = useEditor((s) => s.pages);
  const flush = useEditor((s) => s.flush);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!note) return null;

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(true);
    setOpen(false);
    try {
      // Flush first so an export never misses the last few strokes.
      await flush();
      await task();
      toast.success(`${label} saved`);
    } catch {
      toast.error(`Could not export ${label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <IconButton
        label="Export"
        active={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 />
      </IconButton>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={spring.snap}
            className="absolute right-0 top-full z-40 mt-2 w-[240px] overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]"
          >
            <MenuItem
              icon={<FileText className="h-4 w-4" />}
              label="Export as PDF"
              hint={`${pages.length} page${pages.length === 1 ? "" : "s"}`}
              onClick={() =>
                run("PDF", async () => {
                  const blob = await exportNotePdf(note, pages);
                  downloadBlob(blob, safeFilename(note.title, "pdf"));
                })
              }
            />
            <MenuItem
              icon={<FileImage className="h-4 w-4" />}
              label="Export this page as PNG"
              onClick={() =>
                run("PNG", async () => {
                  const blob = await exportPagePng(note, pages[0]);
                  downloadBlob(blob, safeFilename(note.title, "png"));
                })
              }
            />
            <MenuItem
              icon={<Download className="h-4 w-4" />}
              label="Back up everything"
              hint="All notes and sets"
              onClick={() => run("Backup", () => downloadBackup())}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
    >
      <span className="text-[var(--text-muted)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{label}</span>
        {hint && <span className="block text-[12px] text-[var(--text-faint)]">{hint}</span>}
      </span>
    </button>
  );
}
