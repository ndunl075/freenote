"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const field =
  "w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-faint)] " +
  "outline-none transition-colors duration-150";

/** Quizlet's inputs are underline-first: a 2px rule that goes brand on focus. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          field,
          "border-b-2 border-[var(--border)] px-1 pb-2 pt-1 text-[16px]",
          "focus:border-[var(--brand)]",
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
        "resize-none rounded-[8px] border-2 border-[var(--border)] p-3 text-[15px]",
        "focus:border-[var(--brand)]",
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
          "h-11 rounded-[8px] border-2 border-[var(--border)] px-3 text-[15px]",
          "focus:border-[var(--brand)]",
          className,
        )}
        {...rest}
      />
    );
  },
);
