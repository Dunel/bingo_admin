import * as React from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]"
        >
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-[var(--color-fg-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
