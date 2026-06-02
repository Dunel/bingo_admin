"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Card as CardType } from "@/hooks/use-dashboard-data";
import type { FigureMode } from "@/hooks/use-figure-engine";

export interface FigureResultsProps {
  matchingCards: CardType[];
  mode: FigureMode;
  hasSelection: boolean;
}

export function FigureResults({ matchingCards, mode, hasSelection }: FigureResultsProps) {
  const showWinnerHeader = matchingCards.length > 0;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300",
        showWinnerHeader &&
          "border-[var(--color-bingo-winner)]/50 bg-[var(--color-bingo-winner-bg)]/40",
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {showWinnerHeader ? (
                <span aria-hidden="true" className="animate-pulse-winner inline-flex">
                  <TrophyIcon className="h-5 w-5 text-[var(--color-bingo-winner)]" />
                </span>
              ) : (
                <span aria-hidden="true" className="inline-flex">
                  <SearchIcon className="h-5 w-5 text-[var(--color-fg-muted)]" />
                </span>
              )}
              {mode === "full" ? "Cartones llenos" : "Resultados de la figura"}
            </CardTitle>
            <CardDescription>
              {showWinnerHeader
                ? "Estos cartones completaron la condición."
                : hasSelection
                  ? "Aún no hay cartones que cumplan la condición."
                  : "Selecciona al menos una figura guardada para evaluar."}
            </CardDescription>
          </div>
          {showWinnerHeader ? (
            <Badge variant="winner" size="md" icon={<TrophyIcon className="h-3.5 w-3.5" />}>
              {matchingCards.length} ganador{matchingCards.length === 1 ? "" : "es"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        {showWinnerHeader ? (
          <ul className="stagger flex flex-wrap gap-2">
            {matchingCards.map((card) => (
              <li
                key={`winner-${card.id}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
                  "border border-[var(--color-bingo-winner)] bg-[var(--color-bingo-winner)] text-white shadow-sm",
                  "animate-pulse-winner",
                )}
              >
                <TrophyIcon className="h-3.5 w-3.5" />
                <span>{card.name ?? card.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={
              hasSelection ? (
                <SearchIcon className="h-5 w-5" />
              ) : (
                <ShapePlusIcon className="h-5 w-5" />
              )
            }
            title={hasSelection ? "Sin ganadores aún" : "Sin figura seleccionada"}
            description={
              hasSelection
                ? "Marca más números o ajusta la figura para encontrar cartones ganadores."
                : "Dibuja y guarda una figura, o cambia al modo 'Cartón lleno'."
            }
          />
        )}
      </CardBody>
    </Card>
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
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ShapePlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 4h3v3H4zM13 4h3v3h-3zM4 13h3v3H4zM8.5 8.5h3v3h-3zM13 13h3v3h-3z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
