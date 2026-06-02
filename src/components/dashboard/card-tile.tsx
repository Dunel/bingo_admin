"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { CellThumb } from "./cell-thumb";
import type { Card as CardType } from "@/hooks/use-dashboard-data";

const STATUS_LABEL: Record<CardType["status"], string> = {
  PROCESSED: "Procesada",
  UPLOADED: "Subida",
  ERROR: "Con error",
};

const STATUS_VARIANT: Record<CardType["status"], "success" | "info" | "danger"> = {
  PROCESSED: "success",
  UPLOADED: "info",
  ERROR: "danger",
};

export interface CardTileProps {
  card: CardType;
  isWinner: boolean;
  figureFilterActive: boolean;
  isFigureCell: (row: number, col: number) => boolean;
  onDelete: (cardId: string) => void;
  isDeleting: boolean;
}

function CardTileImpl({ card, isWinner, figureFilterActive, isFigureCell, onDelete, isDeleting }: CardTileProps) {
  return (
    <Card
      className={cn(
        "group relative flex flex-col items-center p-5 text-center transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        isWinner
          ? "border-2 border-[var(--color-bingo-winner)] bg-gradient-to-b from-[var(--color-bingo-winner-bg)] to-[var(--color-surface)] animate-winner-glow"
          : "border border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      {isWinner ? (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 animate-pulse-winner"
          aria-hidden="true"
        >
          <Badge variant="winner" size="md" icon={<TrophyIcon className="h-3.5 w-3.5" />}>
            Ganador
          </Badge>
        </div>
      ) : null}

      <p className="text-base font-bold text-[var(--color-fg)]">{card.name ?? "Sin nombre"}</p>
      <p className="mt-1 text-[11px] font-medium text-[var(--color-fg-subtle)]">
        ID: {card.id.slice(0, 10)}...
      </p>

      <div className="mt-3 inline-flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--color-fg-muted)]">Estado</span>
        <Badge variant={STATUS_VARIANT[card.status]}>{STATUS_LABEL[card.status]}</Badge>
      </div>

      <div className="mt-3 flex w-full flex-col items-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Miniatura
        </p>
        {card.correctedGrid ? (
          <div
            className={cn(
              "mt-2 inline-grid grid-cols-5 gap-1 rounded-[var(--radius-md)] border p-1.5 transition-colors",
              isWinner
                ? "border-[var(--color-bingo-winner)]/40 bg-[var(--color-surface)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)]",
            )}
          >
            {card.correctedGrid.flatMap((row, rowIndex) =>
              row.map((_value, colIndex) => (
                <CellThumb
                  key={`${card.id}-${rowIndex}-${colIndex}`}
                  card={card}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                  isFigureCell={isFigureCell(rowIndex, colIndex)}
                  figureFilterActive={figureFilterActive}
                  isHighlightedWinner={isWinner}
                />
              )),
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs font-medium text-[var(--color-fg-subtle)]">
            Sin grilla procesada.
          </p>
        )}
      </div>

      <p className="mt-3 text-sm font-medium text-[var(--color-fg-muted)]">
        Marcados: <span className="font-bold text-[var(--color-fg)]">{card.markedNumbers.length}</span>
      </p>

      <div className="mt-4 flex w-full items-stretch justify-center gap-2">
        <Link href={`/cards/${card.id}`} className="flex-1">
          <Button variant="primary" size="sm" fullWidth>
            Abrir
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          loading={isDeleting}
          onClick={() => onDelete(card.id)}
          aria-label="Eliminar cartón"
          className="px-3"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export const CardTile = React.memo(CardTileImpl);

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
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 5h14M8 5V3h4v2M6 5l1 12h6l1-12M9 9v6M11 9v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
