"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { isCellMarked } from "@/hooks/use-figure-engine";
import type { Card as CardType } from "@/hooks/use-dashboard-data";

interface CellThumbProps {
  card: CardType;
  rowIndex: number;
  colIndex: number;
  isFigureCell: boolean;
  figureFilterActive: boolean;
  isHighlightedWinner: boolean;
}

function CellThumbImpl({ card, rowIndex, colIndex, isFigureCell, figureFilterActive, isHighlightedWinner }: CellThumbProps) {
  const isCenterFree = rowIndex === 2 && colIndex === 2;
  const isMarked = isCellMarked(card, rowIndex, colIndex);

  const showWinnerDot = isHighlightedWinner && isMarked && !isCenterFree;

  return (
    <div
      className={cn(
        "relative flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold transition-colors",
        isCenterFree
          ? "border border-[var(--color-brand-300)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)] dark:bg-[var(--color-brand-800)] dark:text-[var(--color-brand-300)]"
          : isHighlightedWinner
            ? "border-2 border-[var(--color-bingo-winner)] bg-[var(--color-bingo-marked-bg)] text-[var(--color-bingo-winner-fg)] font-black shadow-[0_0_8px_var(--color-bingo-winner-ring)]"
            : figureFilterActive && !isFigureCell
              ? "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]/60"
              : isMarked
                ? "border border-[var(--color-bingo-marked)] bg-[var(--color-bingo-marked-bg)] text-[var(--color-bingo-winner-fg)]"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]",
      )}
    >
      {isCenterFree ? "F" : card.correctedGrid?.[rowIndex]?.[colIndex] ?? "-"}
      {showWinnerDot ? (
        <span
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-bingo-winner)] ring-1 ring-white/60"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

export const CellThumb = React.memo(CellThumbImpl);
