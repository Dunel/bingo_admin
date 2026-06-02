"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "winner";

export interface ToastInput {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface Toast extends Required<Omit<ToastInput, "description">> {
  description?: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  update: (id: string, input: Partial<ToastInput>) => void;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) => Promise<T>;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TOAST_DEFAULT_DURATION = 4500;

const variantStyles: Record<ToastVariant, { bar: string; icon: string; iconColor: string; ring: string }> = {
  default: {
    bar: "bg-[var(--color-fg-subtle)]",
    icon: "i-info",
    iconColor: "text-[var(--color-fg-muted)]",
    ring: "ring-[var(--color-border)]",
  },
  success: {
    bar: "bg-[var(--color-success)]",
    icon: "i-check",
    iconColor: "text-[var(--color-success)]",
    ring: "ring-[var(--color-success)]/30",
  },
  error: {
    bar: "bg-[var(--color-danger)]",
    icon: "i-x",
    iconColor: "text-[var(--color-danger)]",
    ring: "ring-[var(--color-danger)]/30",
  },
  warning: {
    bar: "bg-[var(--color-warning)]",
    icon: "i-warn",
    iconColor: "text-[var(--color-warning)]",
    ring: "ring-[var(--color-warning)]/30",
  },
  info: {
    bar: "bg-[var(--color-info)]",
    icon: "i-info",
    iconColor: "text-[var(--color-info)]",
    ring: "ring-[var(--color-info)]/30",
  },
  winner: {
    bar: "bg-[var(--color-bingo-winner)]",
    icon: "i-trophy",
    iconColor: "text-[var(--color-bingo-winner)]",
    ring: "ring-[var(--color-bingo-winner)]/40",
  },
};

let toastIdCounter = 0;
function nextToastId() {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const scheduleAutoDismiss = React.useCallback(
    (toast: Toast) => {
      if (toast.duration <= 0) return;
      const timer = setTimeout(() => dismiss(toast.id), toast.duration);
      timers.current.set(toast.id, timer);
    },
    [dismiss],
  );

  const toast = React.useCallback(
    (input: ToastInput): string => {
      const id = input.id ?? nextToastId();
      const newToast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "default",
        duration: input.duration ?? TOAST_DEFAULT_DURATION,
        createdAt: Date.now(),
      };

      setToasts((current) => {
        const filtered = current.filter((t) => t.id !== id);
        return [...filtered, newToast];
      });

      scheduleAutoDismiss(newToast);
      return id;
    },
    [scheduleAutoDismiss],
  );

  const update = React.useCallback(
    (id: string, input: Partial<ToastInput>) => {
      setToasts((current) =>
        current.map((t) => {
          if (t.id !== id) return t;
          const next: Toast = {
            ...t,
            title: input.title ?? t.title,
            description: input.description ?? t.description,
            variant: input.variant ?? t.variant,
            duration: input.duration ?? t.duration,
          };
          return next;
        }),
      );

      const existing = toastsRef.current.find((t) => t.id === id);
      if (existing) {
        const newDuration = input.duration ?? existing.duration;
        if (newDuration > 0) {
          const oldTimer = timers.current.get(id);
          if (oldTimer) clearTimeout(oldTimer);
          const timer = setTimeout(() => dismiss(id), newDuration);
          timers.current.set(id, timer);
        }
      }
    },
    [dismiss],
  );

  const toastsRef = React.useRef(toasts);
  toastsRef.current = toasts;

  const promise = React.useCallback(
    async <T,>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((err: unknown) => string);
      },
    ): Promise<T> => {
      const id = toast({ title: options.loading, variant: "default", duration: 0 });
      try {
        const data = await promise;
        update(id, {
          title: typeof options.success === "function" ? options.success(data) : options.success,
          variant: "success",
        });
        return data;
      } catch (err) {
        update(id, {
          title: typeof options.error === "function" ? options.error(err) : options.error,
          variant: "error",
        });
        throw err;
      }
    },
    [toast, update],
  );

  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss, update, promise }),
    [toasts, toast, dismiss, update, promise],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

/* ----------------------------- ICONS ----------------------------- */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10.5l3.5 3.5L16 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9v5M10 6.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 2.5L18 16H2L10 2.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 8v4M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 21h8m-4-4v4m-5-9a4 4 0 01-4-4V6h4m10 2a4 4 0 004-4V6h-4M7 6h10v5a5 5 0 11-10 0V6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFor({ variant }: { variant: ToastVariant }) {
  const className = "h-5 w-5";
  if (variant === "success") return <CheckIcon className={className} />;
  if (variant === "error") return <XIcon className={className} />;
  if (variant === "warning") return <WarnIcon className={className} />;
  if (variant === "info") return <InfoIcon className={className} />;
  if (variant === "winner") return <TrophyIcon className={className} />;
  return <InfoIcon className={className} />;
}

/* ----------------------------- TOASTER ----------------------------- */

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      role="region"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-4 sm:right-4 sm:top-auto sm:left-auto sm:items-end sm:px-0"
    >
      {toasts.map((t) => {
        const styles = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] ring-1",
              "animate-slide-in-right",
              styles.ring,
            )}
          >
            <div className={cn("absolute inset-y-0 left-0 w-1", styles.bar)} aria-hidden="true" />
            <div className="flex items-start gap-3 p-4 pl-5">
              <div className={cn("mt-0.5 shrink-0", styles.iconColor)}>
                <IconFor variant={t.variant} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-fg)]">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-sm text-[var(--color-fg-muted)]">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar notificación"
                className="shrink-0 rounded-md p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ToastSpinner() {
  return <Spinner size="md" />;
}
