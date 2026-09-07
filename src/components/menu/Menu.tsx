"use client";

import { Check } from "lucide-react";
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils/cn";
import { Popover } from "./Popover";

export type MenuEntry =
  | {
      id: string;
      label: string;
      icon?: ReactNode;
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      /** When defined the item renders as a radio-style choice. */
      checked?: boolean;
      onSelect: () => void;
    }
  | { id: string; separator: true };

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  items: MenuEntry[];
  label: string;
  align?: "start" | "end";
  className?: string;
}

const ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

/**
 * WAI-ARIA menu: arrow keys move focus, Home/End jump, Escape and Tab close,
 * Enter/Space activate. Focus lands on the first item as soon as it opens.
 */
export function Menu({ open, onClose, anchorRef, items, label, align = "end", className }: MenuProps) {
  const onOpened = useCallback((panel: HTMLDivElement) => {
    panel.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => list[(n + list.length) % list.length]?.focus();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focus(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focus(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focus(0);
        break;
      case "End":
        e.preventDefault();
        focus(list.length - 1);
        break;
      case "Tab":
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      align={align}
      role="menu"
      label={label}
      onOpened={onOpened}
      className={className}
    >
      <div onKeyDown={onKeyDown} className="flex flex-col">
        {items.map((entry) =>
          "separator" in entry ? (
            <div
              key={entry.id}
              role="separator"
              className="my-1 h-px bg-[var(--border-soft)]"
            />
          ) : (
            <button
              key={entry.id}
              type="button"
              role={entry.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={entry.checked === undefined ? undefined : entry.checked}
              disabled={entry.disabled}
              onClick={() => {
                onClose();
                entry.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] font-semibold",
                "outline-none transition-colors duration-100",
                "focus-visible:bg-[var(--surface-2)] hover:bg-[var(--surface-2)]",
                "disabled:opacity-40",
                entry.danger ? "text-[var(--incorrect-text)]" : "text-[var(--text)]",
              )}
            >
              {entry.icon && (
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4",
                    entry.danger ? "text-[var(--incorrect-text)]" : "text-[var(--text-muted)]",
                  )}
                >
                  {entry.icon}
                </span>
              )}
              <span className="flex-1 truncate">{entry.label}</span>
              {entry.hint && (
                <span className="text-[12px] font-medium text-[var(--text-faint)]">{entry.hint}</span>
              )}
              {entry.checked && <Check aria-hidden className="h-4 w-4 text-[var(--brand)]" />}
            </button>
          ),
        )}
      </div>
    </Popover>
  );
}

/** Bundles the open state and anchor ref a menu trigger needs. */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return {
    open,
    close,
    toggle,
    setOpen,
    anchorRef,
    triggerProps: {
      ref: anchorRef,
      "aria-haspopup": "menu" as const,
      "aria-expanded": open,
      onClick: toggle,
    },
  };
}
