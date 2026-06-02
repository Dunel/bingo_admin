"use client";

import { useMemo } from "react";
import type { Card } from "./use-dashboard-data";

export type FigureMode = "custom" | "full";
export type FigurePattern = boolean[][];

export function createEmptyPattern(): FigurePattern {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => false));
}

export function clonePattern(pattern: FigurePattern): FigurePattern {
  return pattern.map((row) => [...row]);
}

export function countPatternCells(pattern: FigurePattern): number {
  let count = 0;
  for (const row of pattern) {
    for (const cell of row) if (cell) count += 1;
  }
  return count;
}

export function patternKey(pattern: FigurePattern): string {
  return pattern.map((row) => row.map((v) => (v ? "1" : "0")).join("")).join("|");
}

export function isCellMarked(card: Card, rowIndex: number, colIndex: number): boolean {
  if (rowIndex === 2 && colIndex === 2) return true;
  const value = card.correctedGrid?.[rowIndex]?.[colIndex] ?? null;
  if (value === null) return false;
  return card.markedNumbers.includes(value);
}

function cardMatchesPattern(card: Card, pattern: FigurePattern): boolean {
  if (!card.correctedGrid) return false;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!pattern[row]?.[col]) continue;
      if (!isCellMarked(card, row, col)) return false;
    }
  }
  return true;
}

function cardIsFull(card: Card): boolean {
  if (!card.correctedGrid) return false;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!isCellMarked(card, row, col)) return false;
    }
  }
  return true;
}

export function useFigureEngine({
  cards,
  mode,
  patterns,
}: {
  cards: Card[];
  mode: FigureMode;
  patterns: FigurePattern[];
}) {
  const cellSet = useMemo(() => {
    const set = new Set<string>();
    for (const pattern of patterns) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (pattern[row]?.[col]) set.add(`${row}-${col}`);
        }
      }
    }
    return set;
  }, [patterns]);

  const matchingCards = useMemo(() => {
    if (mode === "full") {
      return cards.filter((card) => cardIsFull(card));
    }
    if (patterns.length === 0) return [] as Card[];
    return cards.filter((card) => patterns.some((p) => cardMatchesPattern(card, p)));
  }, [cards, mode, patterns]);

  const matchingCardIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of matchingCards) set.add(c.id);
    return set;
  }, [matchingCards]);

  const hasSelection = mode === "full" || patterns.length > 0;

  return { matchingCards, matchingCardIds, cellSet, hasSelection };
}
