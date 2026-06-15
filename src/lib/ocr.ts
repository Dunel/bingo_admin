import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { createEmptyBingoGrid, type BingoGrid } from "@/lib/bingo";

type OcrEntry = {
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

type OcrSpaceResponse = {
  ParsedResults?: Array<{
    ParsedText?: string;
    TextOverlay?: {
      Lines?: Array<{
        MinTop?: number;
        Words?: Array<{
          WordText?: string;
          Left?: number;
          Top?: number;
          Width?: number;
          Height?: number;
        }>;
      }>;
    };
  }>;
};

type OcrSpaceExtractResult = {
  entries: OcrEntry[];
  lineGrid: BingoGrid | null;
};

export type OcrCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrGridResult = {
  grid: BingoGrid;
  confidence: number;
  extractedCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCropRect(cropRect: OcrCropRect): OcrCropRect {
  const x = clamp(cropRect.x, 0, 1);
  const y = clamp(cropRect.y, 0, 1);
  const width = clamp(cropRect.width, 0.05, 1);
  const height = clamp(cropRect.height, 0.05, 1);

  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
}

function parseDataUrl(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) {
    throw new Error("Invalid image data URL");
  }

  return Buffer.from(dataUrl.slice(commaIndex + 1), "base64");
}

function parseValue(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 75) {
    return null;
  }
  return value;
}

function splitDigitRunToNumbers(run: string): number[] {
  const memo = new Map<number, number[] | null>();

  function solve(index: number): number[] | null {
    if (index >= run.length) {
      return [];
    }

    if (memo.has(index)) {
      return memo.get(index) ?? null;
    }

    let best: number[] | null = null;

    for (const size of [2, 1]) {
      if (index + size > run.length) {
        continue;
      }

      const piece = run.slice(index, index + size);
      if (piece.length > 1 && piece.startsWith("0")) {
        continue;
      }

      const value = parseValue(piece);
      if (value === null) {
        continue;
      }

      const rest = solve(index + size);
      if (!rest) {
        continue;
      }

      const candidate = [value, ...rest];
      if (!best || candidate.length > best.length) {
        best = candidate;
      }
    }

    memo.set(index, best);
    return best;
  }

  return solve(0) ?? [];
}

function extractNumericTokens(text: string): number[] {
  const direct = text.match(/\b([1-9]|[1-6][0-9]|7[0-5])\b/g) ?? [];
  if (direct.length > 0) {
    return direct
      .map((token) => Number(token))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 75);
  }

  const runs = text.match(/[0-9]{2,}/g) ?? [];
  const fromRuns = runs.flatMap((run) => splitDigitRunToNumbers(run));

  if (fromRuns.length > 0) {
    return fromRuns;
  }

  const loose = text.match(/[0-9]{1,2}/g) ?? [];
  return loose
    .map((token) => Number(token))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 75);
}

function extractEntriesFromText(text: string): OcrEntry[] {
  const matches = extractNumericTokens(text);

  return matches.map((value, index) => ({
    value,
    x: index,
    y: 0,
    width: 1,
    height: 1,
    confidence: 50,
  }));
}

function entriesFromSequentialValues(values: number[], confidence: number): OcrEntry[] {
  return values.map((value, index) => ({
    value,
    x: index,
    y: Math.floor(index / 5),
    width: 1,
    height: 1,
    confidence,
  }));
}

function dedupeEntries(entries: OcrEntry[]): OcrEntry[] {
  const byValue = new Map<number, OcrEntry>();
  for (const entry of entries) {
    const current = byValue.get(entry.value);
    if (!current || entry.confidence > current.confidence) {
      byValue.set(entry.value, entry);
    }
  }
  return [...byValue.values()];
}

function getColumnRange(col: number): [number, number] {
  const ranges: Array<[number, number]> = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];

  return ranges[col] ?? [1, 75];
}

function parseRowByColumnRanges(digits: string, rowIndex: number): Array<number | null> | null {
  const targetCols = rowIndex === 2 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];

  const memo = new Map<string, Array<number | null> | null>();

  function solve(index: number, targetIndex: number): Array<number | null> | null {
    const key = `${index}:${targetIndex}`;
    if (memo.has(key)) {
      return memo.get(key) ?? null;
    }

    if (targetIndex >= targetCols.length) {
      const done = index === digits.length ? [] : null;
      memo.set(key, done);
      return done;
    }

    const col = targetCols[targetIndex] ?? 0;
    const [min, max] = getColumnRange(col);

    for (const size of [2, 1]) {
      if (index + size > digits.length) {
        continue;
      }

      const part = digits.slice(index, index + size);
      if (part.length > 1 && part.startsWith("0")) {
        continue;
      }

      const value = Number(part);
      if (!Number.isInteger(value) || value < min || value > max) {
        continue;
      }

      const rest = solve(index + size, targetIndex + 1);
      if (rest) {
        const result = [value, ...rest];
        memo.set(key, result);
        return result;
      }
    }

    memo.set(key, null);
    return null;
  }

  return solve(0, 0);
}

function extractGridFromParsedText(parsedText: string): BingoGrid | null {
  const lines = parsedText
    .split(/\r?\n/)
    .map((line) => line.replace(/[^0-9]/g, ""))
    .filter((line) => line.length > 0)
    .slice(0, 5);

  if (lines.length < 4) {
    return null;
  }

  const grid = createEmptyBingoGrid();

  for (let row = 0; row < Math.min(5, lines.length); row += 1) {
    const line = lines[row] ?? "";
    const parsed = parseRowByColumnRanges(line, row);
    if (!parsed) {
      continue;
    }

    if (row === 2) {
      const cols = [0, 1, 3, 4];
      for (let i = 0; i < parsed.length; i += 1) {
        const col = cols[i];
        if (col !== undefined) {
          grid[row][col] = parsed[i] ?? null;
        }
      }
      grid[row][2] = null;
      continue;
    }

    for (let col = 0; col < Math.min(5, parsed.length); col += 1) {
      grid[row][col] = parsed[col] ?? null;
    }
  }

  return countFilledCells(grid) >= 10 ? grid : null;
}

function countFilledCells(grid: BingoGrid) {
  let count = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 2 && col === 2) {
        continue;
      }
      if (grid[row][col] !== null) {
        count += 1;
      }
    }
  }
  return count;
}

function fillGridSequentially(entries: OcrEntry[]): BingoGrid {
  const grid = createEmptyBingoGrid();

  const ordered = dedupeEntries(entries)
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    .map((entry) => entry.value)
    .slice(0, 24);

  let index = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 2 && col === 2) {
        grid[row][col] = null;
        continue;
      }

      grid[row][col] = ordered[index] ?? null;
      index += 1;
    }
  }

  return grid;
}

type GridBounds = {
  rows: number[]; // Y positions of horizontal lines (6 values: top, between rows, bottom)
  cols: number[]; // X positions of vertical lines (6 values: left, between cols, right)
};

async function detectGridBounds(source: Buffer, width: number, height: number): Promise<GridBounds | null> {
  try {
    // Método 1: Detección por edge detection con múltiples kernels
    const edgeBounds = await detectGridByEdgeDetection(source, width, height);
    if (edgeBounds && edgeBounds.rows.length === 6 && edgeBounds.cols.length === 6) {
      return edgeBounds;
    }

    // Método 2: Detección por análisis de proyecciones (projection profiles)
    const projectionBounds = await detectGridByProjections(source, width, height);
    if (projectionBounds && projectionBounds.rows.length === 6 && projectionBounds.cols.length === 6) {
      return projectionBounds;
    }

    // Método 3: Detección por threshold adaptativo
    const thresholdBounds = await detectGridByThreshold(source, width, height);
    if (thresholdBounds && thresholdBounds.rows.length === 6 && thresholdBounds.cols.length === 6) {
      return thresholdBounds;
    }

    return null;
  } catch (error) {
    console.error("[OCR] detectGridBounds failed:", error);
    return null;
  }
}

async function detectGridByEdgeDetection(source: Buffer, width: number, height: number): Promise<GridBounds | null> {
  // Usar múltiples kernels de detección de bordes
  const kernels = [
    // Sobel horizontal
    [-1, -2, -1, 0, 0, 0, 1, 2, 1],
    // Sobel vertical
    [-1, 0, 1, -2, 0, 2, -1, 0, 1],
    // Laplaciano
    [0, -1, 0, -1, 4, -1, 0, -1, 0],
  ];

  let bestBounds: GridBounds | null = null;
  let bestScore = 0;

  for (const kernel of kernels) {
    try {
      const { data, info } = await sharp(source)
        .grayscale()
        .normalize()
        .convolve({ width: 3, height: 3, kernel })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const channels = info.channels;
      const w = info.width;
      const h = info.height;

      const horizontalScores: number[] = new Array(h).fill(0);
      const verticalScores: number[] = new Array(w).fill(0);

      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const idx = (y * w + x) * channels;
          const pixel = data[idx];
          if (pixel > 60) {
            horizontalScores[y] += 1;
            verticalScores[x] += 1;
          }
        }
      }

      const rowLines = findLinePositions(horizontalScores, height, 6, 0.12);
      const colLines = findLinePositions(verticalScores, width, 6, 0.12);

      if (rowLines.length === 6 && colLines.length === 6) {
        // Calcular score de calidad de la grilla detectada
        const score = calculateGridQuality(rowLines, colLines, width, height);
        if (score > bestScore) {
          bestScore = score;
          bestBounds = { rows: rowLines, cols: colLines };
        }
      }
    } catch {
      continue;
    }
  }

  return bestBounds;
}

async function detectGridByProjections(source: Buffer, width: number, height: number): Promise<GridBounds | null> {
  // Analizar proyecciones horizontales y verticales
  const { data, info } = await sharp(source)
    .grayscale()
    .normalize()
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const w = info.width;
  const h = info.height;

  // Contar píxeles oscuros por fila y columna
  const horizontalProjections: number[] = new Array(h).fill(0);
  const verticalProjections: number[] = new Array(w).fill(0);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * channels;
      const pixel = data[idx];
      if (pixel < 128) {
        horizontalProjections[y] += 1;
        verticalProjections[x] += 1;
      }
    }
  }

  // Buscar picos en las proyecciones (líneas de la grilla)
  const rowLines = findProjectionPeaks(horizontalProjections, height, 6);
  const colLines = findProjectionPeaks(verticalProjections, width, 6);

  if (rowLines.length === 6 && colLines.length === 6) {
    return { rows: rowLines, cols: colLines };
  }

  return null;
}

async function detectGridByThreshold(source: Buffer, width: number, height: number): Promise<GridBounds | null> {
  // Usar threshold adaptativo para encontrar líneas
  const { data, info } = await sharp(source)
    .grayscale()
    .normalize()
    .median(3)
    .threshold(100)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const w = info.width;
  const h = info.height;

  const horizontalScores: number[] = new Array(h).fill(0);
  const verticalScores: number[] = new Array(w).fill(0);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * channels;
      const pixel = data[idx];
      if (pixel < 50) {
        horizontalScores[y] += 1;
        verticalScores[x] += 1;
      }
    }
  }

  const rowLines = findLinePositions(horizontalScores, height, 6, 0.15);
  const colLines = findLinePositions(verticalScores, width, 6, 0.15);

  if (rowLines.length === 6 && colLines.length === 6) {
    return { rows: rowLines, cols: colLines };
  }

  return null;
}

function findProjectionPeaks(scores: number[], totalSize: number, expectedCount: number): number[] {
  const maxScore = Math.max(...scores);
  if (maxScore === 0) return [];

  const threshold = maxScore * 0.2;
  const minDistance = Math.floor(totalSize / (expectedCount * 1.5));

  const peaks: { pos: number; score: number }[] = [];

  for (let i = 1; i < scores.length - 1; i += 1) {
    if (scores[i] >= threshold && scores[i] > scores[i - 1] && scores[i] > scores[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1].pos >= minDistance) {
        peaks.push({ pos: i, score: scores[i] });
      } else if (scores[i] > peaks[peaks.length - 1].score) {
        peaks[peaks.length - 1] = { pos: i, score: scores[i] };
      }
    }
  }

  if (peaks.length === expectedCount) {
    return peaks.map((p) => p.pos);
  }

  if (peaks.length > expectedCount) {
    peaks.sort((a, b) => b.score - a.score);
    return peaks.slice(0, expectedCount).map((p) => p.pos).sort((a, b) => a - b);
  }

  return [];
}

function calculateGridQuality(rows: number[], cols: number[], width: number, height: number): number {
  let score = 0;

  // Verificar que las líneas estén distribuidas uniformemente
  const expectedRowSpacing = height / 5;
  const expectedColSpacing = width / 5;

  for (let i = 1; i < rows.length; i += 1) {
    const spacing = rows[i] - rows[i - 1];
    const deviation = Math.abs(spacing - expectedRowSpacing) / expectedRowSpacing;
    score += Math.max(0, 1 - deviation);
  }

  for (let i = 1; i < cols.length; i += 1) {
    const spacing = cols[i] - cols[i - 1];
    const deviation = Math.abs(spacing - expectedColSpacing) / expectedColSpacing;
    score += Math.max(0, 1 - deviation);
  }

  return score;
}

function findLinePositions(scores: number[], totalSize: number, expectedCount: number, thresholdRatio: number): number[] {
  const maxScore = Math.max(...scores);
  if (maxScore === 0) return [];

  const threshold = maxScore * thresholdRatio;
  const minDistance = Math.floor(totalSize / (expectedCount * 2));

  const peaks: { pos: number; score: number }[] = [];
  let lastPeakPos = -minDistance;

  for (let i = 0; i < scores.length; i += 1) {
    if (scores[i] >= threshold) {
      if (i - lastPeakPos >= minDistance) {
        peaks.push({ pos: i, score: scores[i] });
        lastPeakPos = i;
      } else if (peaks.length > 0 && scores[i] > peaks[peaks.length - 1].score) {
        peaks[peaks.length - 1] = { pos: i, score: scores[i] };
        lastPeakPos = i;
      }
    }
  }

  // If we found more or fewer than expected, try to select the best ones
  if (peaks.length === expectedCount) {
    return peaks.map((p) => p.pos);
  }

  if (peaks.length > expectedCount) {
    // Take the strongest peaks
    peaks.sort((a, b) => b.score - a.score);
    return peaks
      .slice(0, expectedCount)
      .map((p) => p.pos)
      .sort((a, b) => a - b);
  }

  return [];
}

function mapEntriesToGrid(entries: OcrEntry[], bounds?: GridBounds | null): BingoGrid {
  const grid = createEmptyBingoGrid();

  if (entries.length === 0) {
    return grid;
  }

  if (bounds && bounds.rows.length === 6 && bounds.cols.length === 6) {
    // Use detected grid bounds for accurate placement
    const cellMap = new Map<string, OcrEntry>();

    for (const entry of entries) {
      let row = -1;
      let col = -1;

      // Find which cell this entry belongs to
      for (let r = 0; r < 5; r += 1) {
        if (entry.y >= bounds.rows[r] && entry.y <= bounds.rows[r + 1]) {
          row = r;
          break;
        }
      }

      for (let c = 0; c < 5; c += 1) {
        if (entry.x >= bounds.cols[c] && entry.x <= bounds.cols[c + 1]) {
          col = c;
          break;
        }
      }

      if (row === -1 || col === -1 || (row === 2 && col === 2)) {
        continue;
      }

      const key = `${row}-${col}`;
      const existing = cellMap.get(key);
      if (!existing || entry.confidence > existing.confidence) {
        cellMap.set(key, entry);
      }
    }

    for (const [key, entry] of cellMap.entries()) {
      const [rowText, colText] = key.split("-");
      const row = Number(rowText);
      const col = Number(colText);

      if (Number.isInteger(row) && Number.isInteger(col)) {
        grid[row][col] = entry.value;
      }
    }

    if (countFilledCells(grid) >= 10) {
      return grid;
    }
  }

  // Fallback: use nearest-anchor assignment
  const xAnchors = getAnchorValues(entries.map((entry) => entry.x), 5);
  const yAnchors = getAnchorValues(entries.map((entry) => entry.y), 5);

  const cellMap = new Map<string, OcrEntry>();

  for (const entry of entries) {
    const row = nearestAnchorIndex(entry.y, yAnchors);
    const col = nearestAnchorIndex(entry.x, xAnchors);

    const key = `${row}-${col}`;
    const existing = cellMap.get(key);

    if (!existing || entry.confidence > existing.confidence) {
      cellMap.set(key, entry);
    }
  }

  for (const [key, entry] of cellMap.entries()) {
    const [rowText, colText] = key.split("-");
    const row = Number(rowText);
    const col = Number(colText);

    if (Number.isInteger(row) && Number.isInteger(col) && !(row === 2 && col === 2)) {
      grid[row][col] = entry.value;
    }
  }

  if (countFilledCells(grid) < 10) {
    return fillGridSequentially(entries);
  }

  return grid;
}

function getAnchorValues(values: number[], bucketCount: number): number[] {
  if (values.length === 0) {
    return Array.from({ length: bucketCount }, (_, index) => index);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const anchors: number[] = [];

  for (let i = 0; i < bucketCount; i += 1) {
    const percentile = (i + 0.5) / bucketCount;
    const position = Math.round((sorted.length - 1) * percentile);
    anchors.push(sorted[Math.max(0, Math.min(sorted.length - 1, position))] ?? i);
  }

  return anchors;
}

function nearestAnchorIndex(value: number, anchors: number[]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < anchors.length; i += 1) {
    const distance = Math.abs(value - anchors[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }

  return best;
}

async function extractEntriesWithOcrSpace(source: Buffer, bounds?: GridBounds | null): Promise<OcrSpaceExtractResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? "helloworld";

  const png = await sharp(source).png().toBuffer();
  const formData = new FormData();
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "true");
  formData.append("OCREngine", "2");
  formData.append("scale", "true");
  formData.append("detectOrientation", "true");
  formData.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "bingo.png");

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 20000);

  try {
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: apiKey,
      },
      body: formData,
      signal: abortController.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { entries: [], lineGrid: null };
    }

    const payload = (await response.json()) as OcrSpaceResponse;
    const results = payload.ParsedResults ?? [];
    const entries: OcrEntry[] = [];
    const parsedTexts: string[] = [];

    for (const result of results) {
      if (result.ParsedText) {
        parsedTexts.push(result.ParsedText);
      }

      const lines = result.TextOverlay?.Lines ?? [];

      for (const [lineIndex, line] of lines.entries()) {
        const words = line.Words ?? [];

        for (const [wordIndex, word] of words.entries()) {
          const rawText = word.WordText ?? "";
          const values = extractNumericTokens(rawText);

          if (values.length === 0) {
            continue;
          }

          const left = Number(word.Left ?? wordIndex * 10);
          const top = Number(word.Top ?? line.MinTop ?? lineIndex * 10);
          const width = Number(word.Width ?? 10);
          const height = Number(word.Height ?? 10);

          for (const [valueIndex, value] of values.entries()) {
            entries.push({
              value,
              x: left + width / 2 + valueIndex,
              y: top + height / 2,
              width: width,
              height: height,
              confidence: 80,
            });
          }
        }
      }

      if (entries.length === 0 && result.ParsedText) {
        const values = extractNumericTokens(result.ParsedText);
        for (const [index, value] of values.entries()) {
          entries.push({
            value,
            x: index,
            y: 0,
            width: 1,
            height: 1,
            confidence: 65,
          });
        }
      }
    }

    const deduped = dedupeEntries(entries);
    const lineGrid = parsedTexts.length > 0 ? extractGridFromParsedText(parsedTexts.join("\n")) : null;
    return { entries: deduped, lineGrid };
  } catch {
    return { entries: [], lineGrid: null };
  } finally {
    clearTimeout(timeout);
  }
}

type CellCandidate = {
  value: number;
  bonus: number;
};

function extractCellCandidates(text: string): CellCandidate[] {
  const candidates: CellCandidate[] = [];
  const seen = new Set<number>();

  const pushCandidate = (value: number, bonus = 0) => {
    if (!Number.isInteger(value) || value < 1 || value > 75 || seen.has(value)) {
      return;
    }

    seen.add(value);
    candidates.push({ value, bonus });
  };

  const fromTokens = extractNumericTokens(text);
  for (const value of fromTokens) {
    pushCandidate(value, value >= 10 ? 0.15 : -0.05);
  }

  const digitsOnly = text.replace(/[^0-9]/g, "");

  if (digitsOnly.length >= 2) {
    for (let i = 0; i <= digitsOnly.length - 2; i += 1) {
      const pair = Number(digitsOnly.slice(i, i + 2));
      const repeated = digitsOnly[i] === digitsOnly[i + 1];
      pushCandidate(pair, (repeated ? 0.25 : 0.12) + (pair >= 10 ? 0.1 : 0));
    }
  }

  if (digitsOnly.length === 1) {
    pushCandidate(Number(digitsOnly), -0.1);
  }

  return candidates;
}

async function recognizeCellValue(
  worker: Awaited<ReturnType<typeof createWorker>>,
  cellBuffer: Buffer,
  expectedRange: [number, number],
  cellPosition?: { row: number; col: number },
): Promise<{ value: number; confidence: number } | null> {
  // Generar variantes de preprocesamiento adaptativas
  const variants = await generateAdaptiveVariants(cellBuffer, expectedRange);

  const scores = new Map<number, { score: number; hits: number; totalConfidence: number; maxConfidence: number }>();

  for (const variant of variants) {
    try {
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: variant.psm,
        preserve_interword_spaces: "0",
      } as any);

      const result = await worker.recognize(variant.buffer, {}, { text: true });
      const text = result.data.text ?? "";
      const tesseractConfidence = result.data.confidence ?? 0;

      const candidates = extractCellCandidates(text);
      for (const candidate of candidates) {
        const inRange = candidate.value >= expectedRange[0] && candidate.value <= expectedRange[1];
        const rangeBias = inRange ? 2.0 : -2.5;
        const twoDigitBias = candidate.value >= 10 ? 0.2 : -0.2;
        const confidenceBias = tesseractConfidence > 70 ? 0.5 : tesseractConfidence > 50 ? 0.2 : -0.3;

        const current = scores.get(candidate.value) ?? { score: 0, hits: 0, totalConfidence: 0, maxConfidence: 0 };
        current.score += variant.weight + candidate.bonus + rangeBias + twoDigitBias + confidenceBias;
        current.hits += 1;
        current.totalConfidence += tesseractConfidence;
        current.maxConfidence = Math.max(current.maxConfidence, tesseractConfidence);
        scores.set(candidate.value, current);
      }
    } catch {
      // Ignora variantes puntuales que fallen
    }
  }

  let bestValue: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestHits = -1;
  let bestAvgConfidence = -1;
  let bestMaxConfidence = -1;

  for (const [value, meta] of scores.entries()) {
    const avgConfidence = meta.hits > 0 ? meta.totalConfidence / meta.hits : 0;
    if (
      meta.score > bestScore ||
      (meta.score === bestScore && meta.hits > bestHits) ||
      (meta.score === bestScore && meta.hits === bestHits && avgConfidence > bestAvgConfidence) ||
      (meta.score === bestScore && meta.hits === bestHits && avgConfidence === bestAvgConfidence && meta.maxConfidence > bestMaxConfidence)
    ) {
      bestValue = value;
      bestScore = meta.score;
      bestHits = meta.hits;
      bestAvgConfidence = avgConfidence;
      bestMaxConfidence = meta.maxConfidence;
    }
  }

  // Requiere al menos 2 hits con confianza promedio > 40%
  if (bestValue !== null && bestHits >= 2 && bestAvgConfidence > 40) {
    return { value: bestValue, confidence: bestAvgConfidence };
  }

  // Fallback: si solo hay 1 hit pero con alta confianza, aceptarlo
  if (bestValue !== null && bestHits === 1 && bestMaxConfidence > 70) {
    return { value: bestValue, confidence: bestMaxConfidence };
  }

  return null;
}

async function generateAdaptiveVariants(
  cellBuffer: Buffer,
  _expectedRange: [number, number],
): Promise<Array<{ buffer: Buffer; psm: string; weight: number }>> {
  const variants: Array<{ buffer: Buffer; psm: string; weight: number }> = [];

  // cellBuffer ya está en 200x200 con fit: fill, solo aplicar filtros

  // Variante 1: Original con PSM 7 (single line)
  variants.push({ buffer: cellBuffer, psm: "7", weight: 1.0 });

  // Variante 2: Original con PSM 8 (single word)
  variants.push({ buffer: cellBuffer, psm: "8", weight: 0.95 });

  // Variante 3: Threshold bajo (para números claros sobre fondo oscuro)
  variants.push({ buffer: await sharp(cellBuffer).threshold(120).toBuffer(), psm: "7", weight: 0.85 });

  // Variante 4: Threshold alto (para números oscuros sobre fondo claro)
  variants.push({ buffer: await sharp(cellBuffer).threshold(180).toBuffer(), psm: "7", weight: 0.85 });

  // Variante 5: Negativo (para fondos oscuros)
  variants.push({ buffer: await sharp(cellBuffer).negate().threshold(140).toBuffer(), psm: "7", weight: 0.75 });

  // Variante 6: Sharpen fuerte
  variants.push({ buffer: await sharp(cellBuffer).sharpen({ sigma: 2 }).toBuffer(), psm: "7", weight: 0.7 });

  return variants;
}

async function extractGridByCells(
  source: Buffer,
  worker: Awaited<ReturnType<typeof createWorker>>,
  bounds?: GridBounds | null,
): Promise<BingoGrid> {
  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 50 || height < 50) {
    return createEmptyBingoGrid();
  }

  const grid = createEmptyBingoGrid();

  // Use detected bounds if available, otherwise fall back to fixed 5x5
  const cellBounds: Array<{ left: number; top: number; width: number; height: number }> = [];

  if (bounds && bounds.rows.length === 6 && bounds.cols.length === 6) {
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        cellBounds.push({
          left: bounds.cols[col],
          top: bounds.rows[row],
          width: bounds.cols[col + 1] - bounds.cols[col],
          height: bounds.rows[row + 1] - bounds.rows[row],
        });
      }
    }
  } else {
    const cellWidth = Math.floor(width / 5);
    const cellHeight = Math.floor(height / 5);
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        cellBounds.push({
          left: col * cellWidth,
          top: row * cellHeight,
          width: col === 4 ? width - col * cellWidth : cellWidth,
          height: row === 4 ? height - row * cellHeight : cellHeight,
        });
      }
    }
  }

  let cellIndex = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 2 && col === 2) {
        grid[row][col] = null;
        cellIndex += 1;
        continue;
      }

      const cell = cellBounds[cellIndex];
      cellIndex += 1;

      if (!cell) continue;

      const expectedRange = getColumnRange(col);
      const safeWidth = Math.max(1, cell.width);
      const safeHeight = Math.max(1, cell.height);

      // Padding mínimo: solo 3% para evitar bordes de la celda
      const padX = Math.max(1, Math.floor(safeWidth * 0.03));
      const padY = Math.max(1, Math.floor(safeHeight * 0.03));

      const innerLeft = Math.min(width - 1, cell.left + padX);
      const innerTop = Math.min(height - 1, cell.top + padY);
      const innerWidth = Math.max(10, Math.min(width - innerLeft, safeWidth - padX * 2));
      const innerHeight = Math.max(10, Math.min(height - innerTop, safeHeight - padY * 2));

      // Extraer celda y redimensionar a 200x200 con fill (estirar para llenar)
      const cellBuffer = await sharp(source)
        .extract({
          left: innerLeft,
          top: innerTop,
          width: innerWidth,
          height: innerHeight,
        })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5 })
        .resize({ width: 200, height: 200, fit: "fill" })
        .toBuffer();

      const result = await recognizeCellValue(worker, cellBuffer, expectedRange);
      if (result) {
        console.log(`[OCR] Cell [${row},${col}]: detected ${result.value} (confidence: ${result.confidence.toFixed(1)}%)`);
      } else {
        console.log(`[OCR] Cell [${row},${col}]: no number detected (range: ${expectedRange[0]}-${expectedRange[1]})`);
      }
      grid[row][col] = result?.value ?? null;
    }
  }

  const filledCount = countFilledCells(grid);
  console.log(`[OCR] extractGridByCells completed: ${filledCount}/24 cells filled`);
  return grid;
}

async function extractGridByCellsWithTableFallback(
  source: Buffer,
  worker: Awaited<ReturnType<typeof createWorker>>,
  bounds?: GridBounds | null,
): Promise<BingoGrid> {
  const primary = await extractGridByCells(source, worker, bounds);
  const primaryCount = countFilledCells(primary);

  if (primaryCount >= 16) {
    return primary;
  }

  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 50 || height < 50) {
    return primary;
  }

  // Crop variants para cuando la grilla no llena toda la imagen
  const cropVariants: Array<{ left: number; top: number; width: number; height: number }> = [
    { left: 0.02, top: 0.08, width: 0.96, height: 0.88 },
    { left: 0.03, top: 0.10, width: 0.94, height: 0.84 },
    { left: 0.03, top: 0.14, width: 0.94, height: 0.80 },
    { left: 0.04, top: 0.16, width: 0.92, height: 0.78 },
    { left: 0.05, top: 0.18, width: 0.90, height: 0.76 },
  ];

  let bestGrid = primary;
  let bestCount = primaryCount;

  for (const variant of cropVariants) {
    const left = Math.floor(width * variant.left);
    const top = Math.floor(height * variant.top);
    const cropWidth = Math.max(1, Math.min(width - left, Math.floor(width * variant.width)));
    const cropHeight = Math.max(1, Math.min(height - top, Math.floor(height * variant.height)));

    if (cropWidth < 50 || cropHeight < 50) {
      continue;
    }

    const tableLike = await sharp(source)
      .extract({
        left,
        top,
        width: cropWidth,
        height: cropHeight,
      })
      .toBuffer();

    // Try to detect bounds on the cropped variant
    const variantBounds = await detectGridBounds(tableLike, cropWidth, cropHeight);
    const fallback = await extractGridByCells(tableLike, worker, variantBounds);
    const fallbackCount = countFilledCells(fallback);

    if (fallbackCount > bestCount) {
      bestGrid = fallback;
      bestCount = fallbackCount;
    }
  }

  return bestGrid;
}

function crossValidateGrids(grid1: BingoGrid, grid2: BingoGrid): BingoGrid {
  const result = createEmptyBingoGrid();

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 2 && col === 2) {
        result[row][col] = null;
        continue;
      }

      const val1 = grid1[row][col];
      const val2 = grid2[row][col];

      // If both agree, use that value
      if (val1 !== null && val1 === val2) {
        result[row][col] = val1;
      }
      // If only one has a value, use it
      else if (val1 !== null && val2 === null) {
        result[row][col] = val1;
      }
      else if (val2 !== null && val1 === null) {
        result[row][col] = val2;
      }
      // If they disagree, prefer the one in the valid range for the column
      else if (val1 !== null && val2 !== null) {
        const [min, max] = getColumnRange(col);
        const val1InRange = val1 >= min && val1 <= max;
        const val2InRange = val2 >= min && val2 <= max;

        if (val1InRange && !val2InRange) {
          result[row][col] = val1;
        } else if (val2InRange && !val1InRange) {
          result[row][col] = val2;
        } else {
          // Both in range or both out of range, prefer the first one
          result[row][col] = val1;
        }
      } else {
        result[row][col] = null;
      }
    }
  }

  return result;
}

function validateAndFixGrid(grid: BingoGrid): BingoGrid {
  const result = createEmptyBingoGrid();
  const usedNumbers = new Set<number>();

  // First pass: copy values that are in valid column range
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 2 && col === 2) {
        result[row][col] = null;
        continue;
      }

      const value = grid[row][col];
      if (value === null) {
        result[row][col] = null;
        continue;
      }

      const [min, max] = getColumnRange(col);
      if (value >= min && value <= max && !usedNumbers.has(value)) {
        result[row][col] = value;
        usedNumbers.add(value);
      } else {
        result[row][col] = null;
      }
    }
  }

  return result;
}

export async function extractBingoGridFromDataUrl(dataUrl: string, cropRect?: OcrCropRect): Promise<OcrGridResult | null> {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let apiFallbackGrid: BingoGrid | null = null;
  let apiFallbackCount = 0;

  try {
    const original = parseDataUrl(dataUrl);
    let source = original;

    if (cropRect) {
      const normalized = normalizeCropRect(cropRect);
      const metadata = await sharp(original).metadata();
      const imageWidth = metadata.width ?? 0;
      const imageHeight = metadata.height ?? 0;

      if (imageWidth > 0 && imageHeight > 0) {
        const left = Math.floor(normalized.x * imageWidth);
        const top = Math.floor(normalized.y * imageHeight);
        const width = Math.max(1, Math.floor(normalized.width * imageWidth));
        const height = Math.max(1, Math.floor(normalized.height * imageHeight));

        source = await sharp(original)
          .extract({
            left: clamp(left, 0, Math.max(0, imageWidth - 1)),
            top: clamp(top, 0, Math.max(0, imageHeight - 1)),
            width: clamp(width, 1, Math.max(1, imageWidth - left)),
            height: clamp(height, 1, Math.max(1, imageHeight - top)),
          })
          .toBuffer();
      }
    }

    const metadata = await sharp(source).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    // Detect actual grid boundaries
    const gridBounds = await detectGridBounds(source, width, height);
    if (gridBounds) {
      console.log(`[OCR] Grid bounds detected: ${gridBounds.rows.length} rows, ${gridBounds.cols.length} cols`);
    } else {
      console.log(`[OCR] No grid bounds detected, using fixed 5x5 division`);
    }

    const preprocessedA = await sharp(source)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .threshold(140)
      .toBuffer();

    const preprocessedB = await sharp(source)
      .grayscale()
      .normalize()
      .resize({ width: 2000, withoutEnlargement: false })
      .sharpen({ sigma: 1.5 })
      .threshold(130)
      .toBuffer();

    const preprocessedC = await sharp(source)
      .grayscale()
      .normalize()
      .median(3)
      .sharpen({ sigma: 2 })
      .threshold(150)
      .toBuffer();

    const apiCandidates = [preprocessedB, preprocessedA, preprocessedC, source];
    let bestApiGrid: BingoGrid | null = null;
    let bestApiCount = 0;

    for (const apiCandidate of apiCandidates) {
      const apiResult = await extractEntriesWithOcrSpace(apiCandidate, gridBounds);

      if (apiResult.lineGrid) {
        const lineCount = countFilledCells(apiResult.lineGrid);
        if (lineCount > bestApiCount) {
          bestApiGrid = apiResult.lineGrid;
          bestApiCount = lineCount;
        }
      }

      if (apiResult.entries.length > 0) {
        const apiGrid = mapEntriesToGrid(apiResult.entries, gridBounds);
        const apiCount = countFilledCells(apiGrid);

        if (apiCount > bestApiCount) {
          bestApiGrid = apiGrid;
          bestApiCount = apiCount;
        }
      }

      if (bestApiCount >= 12) {
        break;
      }
    }

    apiFallbackGrid = bestApiGrid;
    apiFallbackCount = bestApiCount;

    if (bestApiGrid && bestApiCount >= 10) {
      return {
        grid: bestApiGrid,
        confidence: 88,
        extractedCount: bestApiCount,
      };
    }

    worker = await createWorker("eng", 1, {
      errorHandler: () => {
        // Evita que errores internos del worker tumben el proceso.
      },
    });

    // Full-image OCR with grid bounds awareness
    const candidates = [
      { buffer: preprocessedA, psm: "6" },
      { buffer: preprocessedB, psm: "6" },
      { buffer: preprocessedC, psm: "6" },
      { buffer: preprocessedA, psm: "11" },
      { buffer: preprocessedB, psm: "11" },
      { buffer: source, psm: "11" },
    ];

    let bestEntries: OcrEntry[] = [];

    for (const candidate of candidates) {
      let result: Awaited<ReturnType<typeof worker.recognize>>;
      try {
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789",
          tessedit_pageseg_mode: candidate.psm,
          preserve_interword_spaces: "1",
        } as any);

        result = await worker.recognize(candidate.buffer, {}, { blocks: true, text: true });
      } catch {
        continue;
      }

      const wordEntries: OcrEntry[] =
        result.data.blocks?.flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.flatMap((line) =>
              line.words
                .map((word) => {
                  const digits = word.text.replace(/[^0-9]/g, "");
                  const value = parseValue(digits);
                  if (value === null) {
                    return null;
                  }

                  return {
                    value,
                    x: (word.bbox.x0 + word.bbox.x1) / 2,
                    y: (word.bbox.y0 + word.bbox.y1) / 2,
                    width: word.bbox.x1 - word.bbox.x0,
                    height: word.bbox.y1 - word.bbox.y0,
                    confidence: Number(word.confidence ?? 0),
                  };
                })
                .filter((entry): entry is OcrEntry => entry !== null),
            ),
          ),
        ) ?? [];

      const textEntries = extractEntriesFromText(result.data.text ?? "");
      const combined = dedupeEntries([...wordEntries, ...textEntries]);

      if (combined.length > bestEntries.length) {
        bestEntries = combined;
      }
    }

    const entries = bestEntries;

    if (entries.length < 6) {
      try {
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789",
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
        } as any);

        const textOnly = await worker.recognize(preprocessedB, {}, { text: true });
        const fallbackValues = extractNumericTokens(textOnly.data.text ?? "");

        if (fallbackValues.length >= 4) {
          bestEntries = entriesFromSequentialValues(fallbackValues, 45);
        }
      } catch {
        // Mantiene bestEntries como esté si falla este fallback.
      }
    }

    if (bestEntries.length < 4) {
      const textOnlyCandidates = [
        { buffer: preprocessedB, psm: "11" },
        { buffer: preprocessedA, psm: "11" },
        { buffer: preprocessedC, psm: "11" },
        { buffer: source, psm: "6" },
      ];

      let bestTextOnly: number[] = [];

      for (const candidate of textOnlyCandidates) {
        try {
          await worker.setParameters({
            tessedit_char_whitelist: "0123456789",
            tessedit_pageseg_mode: candidate.psm,
            preserve_interword_spaces: "1",
          } as any);

          const textResult = await worker.recognize(candidate.buffer, {}, { text: true });
          const values = extractNumericTokens(textResult.data.text ?? "");

          if (values.length > bestTextOnly.length) {
            bestTextOnly = values;
          }
        } catch {
          // Prueba siguiente variante si una falla.
        }
      }

      if (bestTextOnly.length >= 3) {
        bestEntries = entriesFromSequentialValues(bestTextOnly, 40);
      }
    }

    const gridFromWords = bestEntries.length > 0 ? mapEntriesToGrid(bestEntries, gridBounds) : createEmptyBingoGrid();
    const gridFromCells = await extractGridByCellsWithTableFallback(source, worker, gridBounds);

    const wordsFilled = countFilledCells(gridFromWords);
    const cellsFilled = countFilledCells(gridFromCells);

    // Cross-validate the two grids
    const crossValidatedGrid = crossValidateGrids(gridFromWords, gridFromCells);
    const crossValidatedCount = countFilledCells(crossValidatedGrid);

    // Choose the best result: prefer cross-validated if it has good coverage, otherwise the better individual result
    let finalGrid: BingoGrid;
    let finalCount: number;

    if (crossValidatedCount >= 15) {
      finalGrid = crossValidatedGrid;
      finalCount = crossValidatedCount;
    } else {
      finalGrid = cellsFilled >= wordsFilled ? gridFromCells : gridFromWords;
      finalCount = Math.max(cellsFilled, wordsFilled);
    }

    // Validate and fix the grid (remove out-of-range and duplicate numbers)
    finalGrid = validateAndFixGrid(finalGrid);
    finalCount = countFilledCells(finalGrid);

    console.log(`[OCR] Final grid: ${finalCount}/24 cells filled`);
    if (finalCount > 0) {
      const numbers: number[] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (finalGrid[r][c] !== null) numbers.push(finalGrid[r][c] as number);
        }
      }
      console.log(`[OCR] Numbers detected: ${numbers.sort((a, b) => a - b).join(", ")}`);
    }

    const extractedCount = finalCount;

    if (extractedCount === 0 && bestApiGrid && bestApiCount > 0) {
      return {
        grid: validateAndFixGrid(bestApiGrid),
        confidence: 72,
        extractedCount: bestApiCount,
      };
    }

    if (extractedCount === 0) {
      return null;
    }

    const confidence = entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length
      : 50;

    return {
      grid: finalGrid,
      confidence,
      extractedCount,
    };
  } catch (error) {
    if (apiFallbackGrid && apiFallbackCount > 0) {
      return {
        grid: apiFallbackGrid,
        confidence: 65,
        extractedCount: apiFallbackCount,
      };
    }

    console.error("[OCR] extractBingoGridFromDataUrl failed", error);
    return null;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // No-op
      }
    }
  }
}
