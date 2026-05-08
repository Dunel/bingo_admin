export type BingoGrid = (number | null)[][];

export function createEmptyBingoGrid(): BingoGrid {
  const grid: BingoGrid = Array.from({ length: 5 }, () => Array(5).fill(null));
  grid[2][2] = null;
  return grid;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uniqueNumbers(count: number, min: number, max: number) {
  const set = new Set<number>();

  while (set.size < count) {
    set.add(randomInt(min, max));
  }

  return [...set].sort((a, b) => a - b);
}

export function generateClassicBingoGrid(): BingoGrid {
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ] as const;

  const grid = createEmptyBingoGrid();

  for (let col = 0; col < 5; col += 1) {
    const [min, max] = ranges[col];
    const nums = uniqueNumbers(5, min, max);
    for (let row = 0; row < 5; row += 1) {
      grid[row][col] = nums[row];
    }
  }

  // Centro libre
  grid[2][2] = null;
  return grid;
}

export function hasNumber(grid: BingoGrid, target: number): boolean {
  for (const row of grid) {
    for (const value of row) {
      if (value === target) {
        return true;
      }
    }
  }
  return false;
}
