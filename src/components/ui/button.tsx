import * as React from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-fg)] text-[var(--color-fg-inverse)] hover:opacity-90 active:opacity-80 shadow-sm",
  secondary:
    "bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)]",
  outline:
    "bg-transparent text-[var(--color-fg)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-80 shadow-sm",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] font-semibold tracking-tight whitespace-nowrap select-none",
        "transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size === "lg" ? "md" : "sm"} className="shrink-0" />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0">{leftIcon}</span>
      ) : null}
      {children ? <span className="truncate">{children}</span> : null}
      {!loading && rightIcon ? <span className="inline-flex shrink-0">{rightIcon}</span> : null}
    </button>
  );
});
