import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "winner";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] border-[var(--color-border)]",
  brand: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] border-[var(--color-brand-200)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border-transparent",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border-transparent",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border-transparent",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border-transparent",
  winner:
    "bg-[var(--color-bingo-winner-bg)] text-[var(--color-bingo-winner-fg)] border-[var(--color-bingo-winner)]",
};

const variantDark: Partial<Record<BadgeVariant, string>> = {
  neutral: "dark:bg-[var(--color-surface-2)] dark:text-[var(--color-fg-muted)]",
  brand: "dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-200)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

export function Badge({
  className,
  variant = "neutral",
  size = "sm",
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        variantClasses[variant],
        variantDark[variant],
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}
