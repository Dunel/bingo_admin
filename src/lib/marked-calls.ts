import type { BingoGrid } from "@/lib/bingo";

export function extractNumbersFromGrid(grid: BingoGrid): number[] {
  const set = new Set<number>();

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const value = grid[row]?.[col] ?? null;
      if (value !== null && Number.isInteger(value) && value >= 1 && value <= 75) {
        set.add(value);
      }
    }
  }

  return [...set].sort((a, b) => a - b);
}

export function computeMarkedNumbersForGrid(grid: BingoGrid, markedCalls: number[]): number[] {
  const valuesInGrid = new Set(extractNumbersFromGrid(grid));
  return [...new Set(markedCalls)].filter((value) => valuesInGrid.has(value)).sort((a, b) => a - b);
}
