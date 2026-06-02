import * as React from "react";
import { cn } from "@/lib/cn";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthShell({ title, subtitle, children, footer, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        "relative min-h-[calc(100dvh-4rem)] w-full overflow-hidden",
        "bg-[var(--color-bg)]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, color-mix(in oklab, var(--color-brand-500) 18%, transparent) 0%, transparent 60%), radial-gradient(50% 50% at 100% 100%, color-mix(in oklab, var(--color-brand-300) 14%, transparent) 0%, transparent 60%)",
        }}
      />
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col items-stretch justify-center px-5 py-10">
        <div className="animate-fade-in-up">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-brand-700)] text-white shadow-[var(--shadow-md)]">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M5 4h14v16H5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 8h6M9 12h6M9 16h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="17" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
                Bingo Admin
              </p>
              <h1 className="text-2xl font-black tracking-tight text-[var(--color-fg)]">{title}</h1>
            </div>
          </div>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-md)]">
            {subtitle ? (
              <p className="mb-5 text-sm text-[var(--color-fg-muted)]">{subtitle}</p>
            ) : null}
            {children}
          </div>
          {footer ? (
            <div className="mt-5 text-center text-sm text-[var(--color-fg-muted)]">{footer}</div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
