"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const field =
  "w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-faint)] " +
  "outline-none transition-colors duration-150";

/** Notability's fields are boxed and quiet, with a hairline that tints on focus. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          field,
          "h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[15px]",
          "focus:border-[var(--brand)] focus:bg-[var(--surface)]",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        field,
        "resize-none rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[15px]",
        "focus:border-[var(--brand)] focus:bg-[var(--surface)]",
        className,
      )}
      {...rest}
    />
  );
});

/** Boxed variant used in dialogs where an underline reads as unfinished. */
export const BoxInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function BoxInput({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          field,
          "h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[15px]",
          "focus:border-[var(--brand)] focus:bg-[var(--surface)]",
          className,
        )}
        {...rest}
      />
    );
  },
);
