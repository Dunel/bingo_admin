"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface DashboardHeaderProps {
  username: string | null;
  email: string;
  cardsCount: number;
  isAdmin: boolean;
  className?: string;
}

export function DashboardHeader({
  username,
  email,
  cardsCount,
  isAdmin,
  className,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const onLogout = React.useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
      router.refresh();
    }
  }, [router]);

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-brand-300)] bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-900)] p-6 text-white shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--color-brand-500)]/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[var(--color-bingo-winner)]/20 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-brand-300)]">
            Panel
          </p>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight">
            Hola, {username ?? email.split("@")[0]}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {cardsCount === 0
              ? "Aún no tienes cartones registrados"
              : `${cardsCount} cartón${cardsCount === 1 ? "" : "es"} registrado${cardsCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/cards/new"
            className="inline-flex"
          >
            <Button variant="primary" size="md" leftIcon={<PlusIcon className="h-4 w-4" />}>
              Nueva carta
            </Button>
          </Link>
          {isAdmin ? (
            <Link href="/register" className="inline-flex">
              <Button variant="secondary" size="md" leftIcon={<UserPlusIcon className="h-4 w-4" />}>
                Crear usuario
              </Button>
            </Link>
          ) : null}
          <Button
            variant="outline"
            size="md"
            onClick={onLogout}
            loading={loggingOut}
            leftIcon={<LogoutIcon className="h-4 w-4" />}
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 9a3 3 0 100-6 3 3 0 000 6zM2 17a5 5 0 0110 0M14 7v6m-3-3h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 4H4v12h4M12 13l3-3-3-3M15 10H8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
