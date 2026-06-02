"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";
const STORAGE_KEY = "bingo-theme:v1";
const THEME_INIT_KEY = "__bingo_theme_init__";

declare global {
  interface Window {
    [THEME_INIT_KEY]?: boolean;
  }
}

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window[THEME_INIT_KEY]) return;
    window[THEME_INIT_KEY] = true;
    const initial = getPreferredTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full",
        "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[var(--shadow-sm)]",
        "hover:bg-[var(--color-surface-2)] active:scale-95",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        className,
      )}
    >
      <span
        key={mounted ? (isDark ? "moon" : "sun") : "init"}
        className="inline-flex animate-theme-icon"
      >
        {isDark ? <MoonIcon className="h-4.5 w-4.5" /> : <SunIcon className="h-4.5 w-4.5" />}
      </span>
    </button>
  );
}
