"use client";

import { AlertTriangle, Merge } from "lucide-react";
import { useCallback, useRef, useState, type ChangeEvent, type ReactNode, type Ref } from "react";
import { useFocusOnOpen } from "@/components/focus/useFocusOnOpen";
import { Button, Dialog, toast } from "@/components/ui";
import type { FreenoteExport } from "@/lib/db";
import { importAll, isFreenoteExport, type ImportMode } from "@/lib/io/backup";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";

export interface ImportResult {
  notes: number;
  sets: number;
  skipped: number;
}

/**
 * The whole "Import backup" flow in one hook: a hidden file input, the JSON
 * parse + format guard, a Merge-or-Replace dialog, and the import itself.
 * Render `element` anywhere in the tree and call `pick()` from a button.
 */
export function useBackupImport(onImported?: (result: ImportResult) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: FreenoteExport; fileName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const mergeRef = useRef<HTMLButtonElement>(null);
  useFocusOnOpen(pending !== null, mergeRef);

  const pick = useCallback(() => inputRef.current?.click(), []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isFreenoteExport(parsed)) {
        toast.error("That file isn't a freenote backup.");
        return;
      }
      setPending({ data: parsed, fileName: file.name });
    } catch {
      toast.error("Couldn't read that file.");
    }
  };

  const run = async (mode: ImportMode) => {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await importAll(pending.data, mode);
      const parts = [pluralize(result.notes, "note"), pluralize(result.sets, "set")];
      const skipped = result.skipped ? ` · ${result.skipped} already here` : "";
      toast.success(`Imported ${parts.join(" and ")}${skipped}`);
      onImported?.(result);
      setPending(null);
    } catch {
      toast.error("Import failed — nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const close = useCallback(() => {
    if (!busy) setPending(null);
  }, [busy]);

  const element: ReactNode = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json,.freenote"
        onChange={onFile}
        tabIndex={-1}
        aria-hidden
        className="hidden"
      />
      <Dialog
        open={pending !== null}
        onClose={close}
        title="Import backup"
        description={pending ? <BackupSummary data={pending.data} fileName={pending.fileName} /> : null}
        footer={
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
        }
      >
        <div className="grid gap-3">
          <Choice
            ref={mergeRef}
            icon={<Merge />}
            title="Merge"
            hint="Recommended"
            body="Keep everything already on this device and add what's in the file. Anything with a matching id is skipped."
            onClick={() => run("merge")}
            disabled={busy}
          />
          <Choice
            icon={<AlertTriangle />}
            title="Replace"
            body="Erase this device's notes and sets first, then restore the file. Use this to roll back to a known-good backup."
            onClick={() => run("replace")}
            disabled={busy}
            danger
          />
        </div>
      </Dialog>
    </>
  );

  return { pick, element, busy };
}

function BackupSummary({ data, fileName }: { data: FreenoteExport; fileName: string }) {
  const when = new Date(data.exportedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <span>
      <span className="font-semibold text-[var(--text)]">{fileName}</span> · exported {when} ·{" "}
      {pluralize(data.notes.length, "note")}, {pluralize(data.sets.length, "set")},{" "}
      {pluralize(data.subjects.length, "subject")}
    </span>
  );
}

function Choice({
  ref,
  icon,
  title,
  hint,
  body,
  onClick,
  disabled,
  danger,
}: {
  ref?: Ref<HTMLButtonElement>;
  icon: ReactNode;
  title: string;
  hint?: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-[12px] border-2 p-4 text-left transition-colors duration-150",
        "disabled:opacity-50",
        danger
          ? "border-[var(--border)] hover:border-[var(--incorrect)] hover:bg-[var(--incorrect-bg)]"
          : "border-[var(--border)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5",
          danger
            ? "bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]"
            : "bg-[var(--brand-soft)] text-[var(--brand)]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[16px] font-bold">{title}</span>
          {hint && (
            <span className="rounded-full bg-[var(--correct-bg)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--correct-text)]">
              {hint}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text-muted)]">{body}</span>
      </span>
    </button>
  );
}
