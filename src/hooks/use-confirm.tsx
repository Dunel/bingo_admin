"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ui/dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
}

type Resolver = (value: boolean) => void;

interface PendingConfirm extends ConfirmOptions {
  resolver: Resolver;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolver: resolve });
    });
  }, []);

  const handleClose = React.useCallback(() => {
    pending?.resolver(false);
    setPending(null);
  }, [pending]);

  const handleConfirm = React.useCallback(() => {
    pending?.resolver(true);
    setPending(null);
  }, [pending]);

  const value = React.useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <ConfirmDialog
          open
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={pending.title}
          description={pending.description}
          confirmText={pending.confirmText}
          cancelText={pending.cancelText}
          variant={pending.variant}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>");
  }
  return ctx.confirm;
}
