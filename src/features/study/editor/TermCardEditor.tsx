"use client";

import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Image as ImageIcon, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { blobs } from "@/lib/db";
import { Input } from "@/components/ui";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";

export interface DraftTerm {
  /** Stable local key; equals the db id once persisted. */
  key: string;
  termId: string | null;
  term: string;
  definition: string;
  imageBlobId: string | null;
}

export function TermCardEditor({
  draft,
  index,
  count,
  onChange,
  onRemove,
  onAddAfter,
  onMove,
  autoFocus,
}: {
  draft: DraftTerm;
  index: number;
  count: number;
  onChange: (patch: Partial<DraftTerm>) => void;
  onRemove: () => void;
  onAddAfter: () => void;
  onMove: (delta: number) => void;
  autoFocus?: boolean;
}) {
  const controls = useDragControls();
  const termInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{ blobId: string; url: string } | null>(null);
  const imageUrl = draft.imageBlobId && loaded?.blobId === draft.imageBlobId ? loaded.url : null;

  useEffect(() => {
    if (autoFocus) termInput.current?.focus();
  }, [autoFocus]);

  /* Object URLs for the thumbnail, revoked when the image changes or the card unmounts. */
  useEffect(() => {
    const blobId = draft.imageBlobId;
    if (!blobId) return;
    let url: string | null = null;
    let cancelled = false;
    blobs
      .url(blobId)
      .then((u) => {
        if (!u) return;
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setLoaded({ blobId, url: u });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft.imageBlobId]);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    const id = await blobs.put(file);
    onChange({ imageBlobId: id });
  };

  return (
    <Reorder.Item
      value={draft}
      dragListener={false}
      dragControls={controls}
      transition={spring.snap}
      whileDrag={{ scale: 1.01, zIndex: 10 }}
      className="rounded-[8px] bg-[var(--surface)] shadow-[var(--shadow-sm)] active:shadow-[var(--shadow-lg)]"
      as="li"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5 md:px-6">
        <span className="text-[15px] font-bold text-[var(--text-muted)] tabular-nums">{index + 1}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Reorder card ${index + 1}. Use arrow keys to move.`}
            title="Drag to reorder"
            onPointerDown={(e) => controls.start(e)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                onMove(-1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                onMove(1);
              }
            }}
            className="inline-flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={`Delete card ${index + 1}`}
            title="Delete"
            onClick={onRemove}
            disabled={count <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--incorrect-bg)] hover:text-[var(--incorrect-text)] disabled:opacity-30"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-8 md:px-6 md:py-5">
        <Field label="Term">
          <Input
            ref={termInput}
            value={draft.term}
            onChange={(e) => onChange({ term: e.target.value })}
            placeholder="Enter term"
            aria-label={`Term ${index + 1}`}
          />
        </Field>
        <Field label="Definition">
          <Input
            value={draft.definition}
            onChange={(e) => onChange({ definition: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddAfter();
              }
            }}
            placeholder="Enter definition"
            aria-label={`Definition ${index + 1}`}
          />
        </Field>
        <div className="flex items-start">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pickImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {imageUrl ? (
            <div className="relative h-[60px] w-[84px] overflow-hidden rounded-[8px] border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => onChange({ imageBlobId: null })}
                className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--overlay)] text-[var(--text-inverse)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={cn(
                "flex h-[60px] w-[84px] flex-col items-center justify-center gap-0.5 rounded-[8px] border-2 border-dashed",
                "border-[var(--border)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]",
                "transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]",
              )}
            >
              <ImageIcon className="h-5 w-5" aria-hidden />
              Image
            </button>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
