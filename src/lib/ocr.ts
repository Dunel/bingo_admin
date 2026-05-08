import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { createEmptyBingoGrid, type BingoGrid } from "@/lib/bingo";

type OcrEntry = {
  value: number;
  x: number;
  y: number;
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

  // Fallback when OCR returns glued digits without spaces.
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
    confidence: 50,
  }));
}

function entriesFromSequentialValues(values: number[], confidence: number): OcrEntry[] {
  return values.map((value, index) => ({
    value,
    x: index,
    y: Math.floor(index / 5),
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

function mapEntriesToGrid(entries: OcrEntry[]): BingoGrid {
  const grid = createEmptyBingoGrid();

  if (entries.length === 0) {
    return grid;
  }

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

async function extractEntriesWithOcrSpace(source: Buffer): Promise<OcrSpaceExtractResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? "helloworld";

  const png = await sharp(source).png().toBuffer();
  const formData = new FormData();
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "true");
  formData.append("OCREngine", "2");
  formData.append("scale", "true");
  formData.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "bingo.png");

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 12000);

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
    pushCandidate(value, value >= 10 ? 0.12 : -0.08);
  }

  const digitsOnly = text.replace(/[^0-9]/g, "");

  if (digitsOnly.length >= 2) {
    for (let i = 0; i <= digitsOnly.length - 2; i += 1) {
      const pair = Number(digitsOnly.slice(i, i + 2));
      const repeated = digitsOnly[i] === digitsOnly[i + 1];
      pushCandidate(pair, (repeated ? 0.2 : 0.1) + (pair >= 10 ? 0.08 : 0));
    }
  }

  if (digitsOnly.length === 1) {
    pushCandidate(Number(digitsOnly), -0.12);
  }

  return candidates;
}

async function recognizeCellValue(
  worker: Awaited<ReturnType<typeof createWorker>>,
  cellBuffer: Buffer,
  expectedRange: [number, number],
): Promise<number | null> {
  const variants = [
    { buffer: cellBuffer, psm: "10", weight: 1.0 },
    { buffer: cellBuffer, psm: "8", weight: 0.9 },
    { buffer: await sharp(cellBuffer).normalize().sharpen().toBuffer(), psm: "13", weight: 0.85 },
    {
      buffer: await sharp(cellBuffer).threshold(160).toBuffer(),
      psm: "10",
      weight: 0.8,
    },
    {
      buffer: await sharp(cellBuffer).negate().threshold(150).toBuffer(),
      psm: "10",
      weight: 0.75,
    },
  ];

  const scores = new Map<number, { score: number; hits: number }>();

  for (const variant of variants) {
    try {
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: variant.psm,
        preserve_interword_spaces: "0",
      } as any);

      const result = await worker.recognize(variant.buffer, {}, { text: true });
      const text = result.data.text ?? "";

      const candidates = extractCellCandidates(text);
      for (const candidate of candidates) {
        const inRange = candidate.value >= expectedRange[0] && candidate.value <= expectedRange[1];
        const rangeBias = inRange ? 0.95 : -1.1;
        const twoDigitBias = candidate.value >= 10 ? 0.1 : -0.2;

        const current = scores.get(candidate.value) ?? { score: 0, hits: 0 };
        current.score += variant.weight + candidate.bonus + rangeBias + twoDigitBias;
        current.hits += 1;
        scores.set(candidate.value, current);
      }
    } catch {
      // Ignora variantes puntuales que fallen para no abortar todo el OCR.
    }
  }

  let bestValue: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestHits = -1;

  for (const [value, meta] of scores.entries()) {
    if (meta.score > bestScore || (meta.score === bestScore && meta.hits > bestHits)) {
      bestValue = value;
      bestScore = meta.score;
      bestHits = meta.hits;
    }
  }

  if (bestValue !== null) {
    return bestValue;
  }

  return null;
}

async function extractGridByCells(source: Buffer, worker: Awaited<ReturnType<typeof createWorker>>): Promise<BingoGrid> {
  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 50 || height < 50) {
    return createEmptyBingoGrid();
  }

  const grid = createEmptyBingoGrid();
  const cellWidth = Math.floor(width / 5);
  const cellHeight = Math.floor(height / 5);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 2 && col === 2) {
        grid[row][col] = null;
        continue;
      }

      const left = col * cellWidth;
      const top = row * cellHeight;
      const expectedRange = getColumnRange(col);
      const rawWidth = col === 4 ? width - left : cellWidth;
      const rawHeight = row === 4 ? height - top : cellHeight;

      const safeWidth = Math.max(1, rawWidth);
      const safeHeight = Math.max(1, rawHeight);

      const padX = Math.max(1, Math.floor(safeWidth * 0.12));
      const padY = Math.max(1, Math.floor(safeHeight * 0.12));

      const innerLeft = Math.min(width - 1, left + padX);
      const innerTop = Math.min(height - 1, top + padY);
      const innerWidth = Math.max(1, Math.min(width - innerLeft, safeWidth - padX * 2));
      const innerHeight = Math.max(1, Math.min(height - innerTop, safeHeight - padY * 2));

      const cellBuffer = await sharp(source)
        .extract({
          left: innerLeft,
          top: innerTop,
          width: innerWidth,
          height: innerHeight,
        })
        .grayscale()
        .normalize()
        .sharpen()
        .resize({ width: 320, height: 320, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer();

      let value = await recognizeCellValue(worker, cellBuffer, expectedRange);

      if (value === null) {
        const loosePadX = Math.max(1, Math.floor(safeWidth * 0.05));
        const loosePadY = Math.max(1, Math.floor(safeHeight * 0.05));
        const looseLeft = Math.min(width - 1, left + loosePadX);
        const looseTop = Math.min(height - 1, top + loosePadY);
        const looseWidth = Math.max(1, Math.min(width - looseLeft, safeWidth - loosePadX * 2));
        const looseHeight = Math.max(1, Math.min(height - looseTop, safeHeight - loosePadY * 2));

        const looseCellBuffer = await sharp(source)
          .extract({
            left: looseLeft,
            top: looseTop,
            width: looseWidth,
            height: looseHeight,
          })
          .grayscale()
          .normalize()
          .resize({ width: 320, height: 320, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .toBuffer();

        value = await recognizeCellValue(worker, looseCellBuffer, expectedRange);
      }

      grid[row][col] = value;
    }
  }

  return grid;
}

async function extractGridByCellsWithTableFallback(source: Buffer, worker: Awaited<ReturnType<typeof createWorker>>): Promise<BingoGrid> {
  const primary = await extractGridByCells(source, worker);
  const primaryCount = countFilledCells(primary);

  if (primaryCount >= 12) {
    return primary;
  }

  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 50 || height < 50) {
    return primary;
  }

  const cropVariants: Array<{ left: number; top: number; width: number; height: number }> = [
    { left: 0.03, top: 0.10, width: 0.94, height: 0.84 },
    { left: 0.03, top: 0.14, width: 0.94, height: 0.80 },
    { left: 0.03, top: 0.18, width: 0.94, height: 0.78 },
    { left: 0.04, top: 0.16, width: 0.92, height: 0.78 },
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

    const fallback = await extractGridByCells(tableLike, worker);
    const fallbackCount = countFilledCells(fallback);

    if (fallbackCount > bestCount) {
      bestGrid = fallback;
      bestCount = fallbackCount;
    }
  }

  return bestGrid;
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

    const preprocessedA = await sharp(source)
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(165)
      .toBuffer();

    const preprocessedB = await sharp(source)
      .grayscale()
      .normalize()
      .resize({ width: 1800, withoutEnlargement: false })
      .sharpen()
      .threshold(150)
      .toBuffer();

    // OCR.Space en multiples variantes para no depender de una sola transformacion.
    const apiCandidates = [preprocessedB, preprocessedA, source];
    let bestApiGrid: BingoGrid | null = null;
    let bestApiCount = 0;

    for (const apiCandidate of apiCandidates) {
      const apiResult = await extractEntriesWithOcrSpace(apiCandidate);

      if (apiResult.lineGrid) {
        const lineCount = countFilledCells(apiResult.lineGrid);
        if (lineCount > bestApiCount) {
          bestApiGrid = apiResult.lineGrid;
          bestApiCount = lineCount;
        }
      }

      if (apiResult.entries.length > 0) {
        const apiGrid = mapEntriesToGrid(apiResult.entries);
        const apiCount = countFilledCells(apiGrid);

        if (apiCount > bestApiCount) {
          bestApiGrid = apiGrid;
          bestApiCount = apiCount;
        }
      }

      if (bestApiCount >= 10) {
        break;
      }
    }

    apiFallbackGrid = bestApiGrid;
    apiFallbackCount = bestApiCount;

    if (bestApiGrid && bestApiCount >= 6) {
      return {
        grid: bestApiGrid,
        confidence: 82,
        extractedCount: bestApiCount,
      };
    }

    worker = await createWorker("eng", 1, {
      errorHandler: () => {
        // Evita que errores internos del worker tumben el proceso.
      },
    });

    const candidates = [
      { buffer: preprocessedA, psm: "6" },
      { buffer: preprocessedB, psm: "6" },
      { buffer: preprocessedA, psm: "11" },
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

    const gridFromWords = bestEntries.length > 0 ? mapEntriesToGrid(bestEntries) : createEmptyBingoGrid();
    const gridFromCells = await extractGridByCellsWithTableFallback(source, worker);

    const wordsFilled = countFilledCells(gridFromWords);
    const cellsFilled = countFilledCells(gridFromCells);

    const grid = cellsFilled >= wordsFilled ? gridFromCells : gridFromWords;
    const extractedCount = Math.max(cellsFilled, wordsFilled);

    if (extractedCount === 0 && bestApiGrid && bestApiCount > 0) {
      return {
        grid: bestApiGrid,
        confidence: 68,
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
      grid,
      confidence,
      extractedCount,
    };
  } catch (error) {
    if (apiFallbackGrid && apiFallbackCount > 0) {
      return {
        grid: apiFallbackGrid,
        confidence: 62,
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
