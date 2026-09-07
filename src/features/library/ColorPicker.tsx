"use client";

import { Check } from "lucide-react";
import { useCallback, type KeyboardEvent, type RefObject } from "react";
import { Popover } from "@/components/menu/Popover";
import { cn } from "@/lib/utils/cn";
import { SUBJECT_COLORS } from "./colors";

const COLS = 6;

/**
 * Swatch grid for a subject's colour. Behaves as a radio group: arrows move
 * through the grid in two dimensions, Enter or Space picks, Escape closes.
 */
export function ColorPicker({
  open,
  onClose,
  anchorRef,
  value,
  onChange,
  label,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const onOpened = useCallback((panel: HTMLDivElement) => {
    const current =
      panel.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
      panel.querySelector<HTMLElement>('[role="radio"]');
    current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const i = radios.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLS,
      ArrowUp: -COLS,
    };
    const delta = step[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    radios[(i + delta + radios.length) % radios.length]?.focus();
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      role="dialog"
      label={label}
      onOpened={onOpened}
      className="min-w-0 p-3"
    >
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {SUBJECT_COLORS.map((c) => {
          const selected = c.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                onChange(c.value);
                onClose();
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-100",
                "hover:scale-110 focus-visible:scale-110",
                selected && "ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]",
              )}
              style={{ background: c.value }}
            >
              {selected && <Check aria-hidden className="h-4 w-4 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
