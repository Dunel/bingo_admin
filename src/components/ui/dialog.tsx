"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type DialogSize = "sm" | "md" | "lg";

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: DialogSize;
  hideCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideCloseButton = false,
  closeOnBackdrop = true,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const node = dialogRef.current;
      if (!node) return;
      const focusable = node.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 30);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]",
          "animate-scale-in",
          sizeClasses[size],
        )}
      >
        <div className="flex items-start gap-4 p-6 pb-2">
          <div className="flex-1 space-y-1.5">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-[var(--color-fg)]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-[var(--color-fg-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {!hideCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-md p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
        {children ? <div className="px-6 py-2">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 p-6 pt-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            autoFocus
          >
            {confirmText}
          </Button>
        </>
      }
    />
  );
}
