import { NextResponse } from "next/server";
import { createEmptyBingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { computeMarkedNumbersForGrid } from "@/lib/marked-calls";
import { extractBingoGridFromDataUrl, type OcrCropRect } from "@/lib/ocr";
import { prisma } from "@/lib/prisma";
import { generateBodySchema, MODE_RECT_COUNT, type CardMode } from "@/lib/validations/cards";
import { idParamSchema } from "@/lib/validations/common";

type GeneratedCardStatus = "PROCESSED" | "ERROR";

type Params = {
  params: Promise<{ id: string }>;
};

function splitIntoX2CropRects(base: OcrCropRect): OcrCropRect[] {
  const halfWidth = base.width / 2;
  const insetX = Math.min(base.width * 0.008, halfWidth * 0.08);
  const insetY = Math.min(base.height * 0.008, base.height * 0.08);

  const leftX = base.x + insetX;
  const rightX = base.x + halfWidth + insetX;
  const topY = base.y + insetY;
  const cellWidth = Math.max(halfWidth - insetX * 2, 0.02);
  const cellHeight = Math.max(base.height - insetY * 2, 0.02);

  return [
    { x: leftX, y: topY, width: cellWidth, height: cellHeight },
    { x: rightX, y: topY, width: cellWidth, height: cellHeight },
  ];
}

function splitIntoX4CropRects(base: OcrCropRect): OcrCropRect[] {
  const halfWidth = base.width / 2;
  const halfHeight = base.height / 2;
  const insetX = Math.min(base.width * 0.008, halfWidth * 0.08);
  const insetY = Math.min(base.height * 0.008, halfHeight * 0.08);

  const leftX = base.x + insetX;
  const rightX = base.x + halfWidth + insetX;
  const topY = base.y + insetY;
  const bottomY = base.y + halfHeight + insetY;
  const quadWidth = Math.max(halfWidth - insetX * 2, 0.02);
  const quadHeight = Math.max(halfHeight - insetY * 2, 0.02);

  return [
    { x: leftX, y: topY, width: quadWidth, height: quadHeight },
    { x: rightX, y: topY, width: quadWidth, height: quadHeight },
    { x: leftX, y: bottomY, width: quadWidth, height: quadHeight },
    { x: rightX, y: bottomY, width: quadWidth, height: quadHeight },
  ];
}

function splitIntoX6CropRects(base: OcrCropRect): OcrCropRect[] {
  const thirdWidth = base.width / 3;
  const halfHeight = base.height / 2;
  const insetX = Math.min(base.width * 0.008, thirdWidth * 0.08);
  const insetY = Math.min(base.height * 0.008, halfHeight * 0.08);

  const colX = (col: number) => base.x + thirdWidth * col + insetX;
  const rowY = (row: number) => base.y + halfHeight * row + insetY;
  const cellWidth = Math.max(thirdWidth - insetX * 2, 0.02);
  const cellHeight = Math.max(halfHeight - insetY * 2, 0.02);

  return [
    { x: colX(0), y: rowY(0), width: cellWidth, height: cellHeight },
    { x: colX(1), y: rowY(0), width: cellWidth, height: cellHeight },
    { x: colX(2), y: rowY(0), width: cellWidth, height: cellHeight },
    { x: colX(0), y: rowY(1), width: cellWidth, height: cellHeight },
    { x: colX(1), y: rowY(1), width: cellWidth, height: cellHeight },
    { x: colX(2), y: rowY(1), width: cellWidth, height: cellHeight },
  ];
}

function splitForMode(mode: CardMode, base: OcrCropRect): OcrCropRect[] {
  if (mode === "x2") return splitIntoX2CropRects(base);
  if (mode === "x4") return splitIntoX4CropRects(base);
  if (mode === "x6") return splitIntoX6CropRects(base);
  return [base];
}

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsedParams = idParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: parsedParams.error.issues[0]?.message ?? "ID inválido." }, { status: 400 });
  }

  const { id } = parsedParams.data;

  const card = await prisma.bingoCard.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      userId: true,
      name: true,
      sourceImageUrl: true,
      sourceMimeType: true,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Carta no encontrada." }, { status: 404 });
  }

  const globalMarked = await prisma.userMarkedCall.findMany({
    where: { userId: user.id },
    select: { number: true },
    orderBy: { createdAt: "asc" },
  });
  const globalMarkedNumbers = globalMarked.map((item: { number: number }) => item.number);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = generateBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const payload = parsedBody.data;

  const cropRect = payload.cropRect;
  const rawMode = payload.mode ?? "single";
  const mode: CardMode = rawMode === "single" ? "single" : rawMode;
  const expectedCount = MODE_RECT_COUNT[mode];
  const isMultiCard = mode !== "single";

  if (isMultiCard) {
    const explicitRects = Array.isArray(payload.cropRects)
      ? payload.cropRects.slice(0, expectedCount)
      : [];

    const base = cropRect ?? { x: 0, y: 0, width: 1, height: 1 };
    const quadrants = explicitRects.length === expectedCount ? explicitRects : splitForMode(mode, base);
    const baseName = card.name?.trim() ? card.name.trim() : null;

    const results = await Promise.all(
      quadrants.map((rect) => extractBingoGridFromDataUrl(card.sourceImageUrl, rect)),
    );

    const normalized = results.map((result) => ({
      grid: result?.grid ?? createEmptyBingoGrid(),
      status: (result ? "PROCESSED" : "ERROR") as GeneratedCardStatus,
      aiConfidence: result ? result.confidence / 100 : null,
      extractedCount: result?.extractedCount ?? 0,
    }));

    const first = normalized[0] ?? {
      grid: createEmptyBingoGrid(),
      status: "ERROR" as GeneratedCardStatus,
      aiConfidence: null,
      extractedCount: 0,
    };

    const updatedFirst = await prisma.bingoCard.update({
      where: { id },
      data: {
        name: baseName ? `${baseName}/1` : card.name,
        status: first.status,
        detectedGrid: first.grid,
        correctedGrid: first.grid,
        markedNumbers: computeMarkedNumbersForGrid(first.grid, globalMarkedNumbers),
        aiConfidence: first.aiConfidence,
      },
      select: {
        id: true,
        status: true,
        correctedGrid: true,
        aiConfidence: true,
        updatedAt: true,
      },
    });

    const restToCreate = normalized.slice(1);
    const created = [] as Array<{ id: string; status: string; extractedCount: number }>;

    for (const item of restToCreate) {
      const createdCard = await prisma.bingoCard.create({
        data: {
          userId: card.userId,
          name: baseName ? `${baseName}/${created.length + 2}` : null,
          sourceImageUrl: card.sourceImageUrl,
          sourceMimeType: card.sourceMimeType,
          status: item.status,
          detectedGrid: item.grid,
          correctedGrid: item.grid,
          markedNumbers: computeMarkedNumbersForGrid(item.grid, globalMarkedNumbers),
          aiConfidence: item.aiConfidence,
        },
        select: {
          id: true,
          status: true,
        },
      });

      created.push({
        id: createdCard.id,
        status: createdCard.status,
        extractedCount: item.extractedCount,
      });
    }

    return NextResponse.json({
      mode,
      card: updatedFirst,
      cards: [
        { id: updatedFirst.id, status: updatedFirst.status, extractedCount: first.extractedCount },
        ...created,
      ],
      extractedCount: normalized.reduce((sum, item) => sum + item.extractedCount, 0),
      warning: normalized.some((item) => item.status === "ERROR")
        ? "Uno o más cartones no se detectaron correctamente. Puedes editarlos manualmente."
        : null,
    });
  }

  const ocrFromCrop = await extractBingoGridFromDataUrl(card.sourceImageUrl, cropRect);
  const ocrFromFull = !ocrFromCrop || ocrFromCrop.extractedCount < 8
    ? await extractBingoGridFromDataUrl(card.sourceImageUrl)
    : null;

  const ocrResult =
    ocrFromFull && (!ocrFromCrop || ocrFromFull.extractedCount > ocrFromCrop.extractedCount)
      ? ocrFromFull
      : ocrFromCrop;

  const grid = ocrResult?.grid ?? createEmptyBingoGrid();
  const status = ocrResult && (ocrResult.extractedCount ?? 0) > 0 ? "PROCESSED" : "ERROR";

  const updated = await prisma.bingoCard.update({
    where: { id },
    data: {
      status,
      detectedGrid: grid,
      correctedGrid: grid,
      markedNumbers: computeMarkedNumbersForGrid(grid, globalMarkedNumbers),
      aiConfidence: ocrResult ? ocrResult.confidence / 100 : null,
    },
    select: {
      id: true,
      status: true,
      correctedGrid: true,
      aiConfidence: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    card: updated,
    extractedCount: ocrResult?.extractedCount ?? 0,
    warning: ocrResult ? null : "No se detectaron números con OCR. Puedes corregir la grilla manualmente.",
  });
}
