import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)]",
        "placeholder:text-[var(--color-fg-subtle)] placeholder:font-normal",
        "transition-shadow duration-150",
        "focus:outline-none focus:ring-2 focus:ring-offset-0",
        invalid
          ? "border-[var(--color-danger)] focus:ring-[var(--color-danger)]"
          : "border-[var(--color-border-strong)] focus:ring-[var(--color-border-focus)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)]",
        "placeholder:text-[var(--color-fg-subtle)] placeholder:font-normal",
        "transition-shadow duration-150 resize-y min-h-[88px]",
        "focus:outline-none focus:ring-2 focus:ring-offset-0",
        invalid
          ? "border-[var(--color-danger)] focus:ring-[var(--color-danger)]"
          : "border-[var(--color-border-strong)] focus:ring-[var(--color-border-focus)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
