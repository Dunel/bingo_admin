import { NextResponse } from "next/server";
import type { BingoCardStatus } from "@prisma/client";
import { createEmptyBingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { computeMarkedNumbersForGrid } from "@/lib/marked-calls";
import { extractBingoGridFromDataUrl, type OcrCropRect } from "@/lib/ocr";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

type GenerateBody = {
  cropRect?: OcrCropRect;
  cropRects?: OcrCropRect[];
  mode?: "single" | "x4";
};

function isValidCropRect(value: unknown): value is OcrCropRect {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rect = value as Record<string, unknown>;
  const keys = ["x", "y", "width", "height"] as const;
  return keys.every((key) => typeof rect[key] === "number" && Number.isFinite(rect[key] as number));
}

function splitIntoX4CropRects(base: OcrCropRect): OcrCropRect[] {
  // Divide exactamente en 2x2; un pequeño inset evita bordes gruesos de separación.
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

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

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
  const globalMarkedNumbers = globalMarked.map((item) => item.number);

  let body: GenerateBody = {};
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    body = {};
  }

  const cropRect = isValidCropRect(body.cropRect) ? body.cropRect : undefined;
  const mode = body.mode === "x4" ? "x4" : "single";

  if (mode === "x4") {
    const explicitRects = Array.isArray(body.cropRects)
      ? body.cropRects.filter((value): value is OcrCropRect => isValidCropRect(value)).slice(0, 4)
      : [];

    if (Array.isArray(body.cropRects) && explicitRects.length !== 4) {
      return NextResponse.json(
        { error: "En modo x4 debes enviar 4 rectángulos válidos." },
        { status: 400 },
      );
    }

    const base = cropRect ?? { x: 0, y: 0, width: 1, height: 1 };
    const quadrants = explicitRects.length === 4 ? explicitRects : splitIntoX4CropRects(base);
    const baseName = card.name?.trim() ? card.name.trim() : null;

    const results = await Promise.all(
      quadrants.map((rect) => extractBingoGridFromDataUrl(card.sourceImageUrl, rect)),
    );

    const normalized = results.map((result) => ({
      grid: result?.grid ?? createEmptyBingoGrid(),
      status: (result ? "PROCESSED" : "ERROR") as BingoCardStatus,
      aiConfidence: result ? result.confidence / 100 : null,
      extractedCount: result?.extractedCount ?? 0,
    }));

    const first = normalized[0] ?? {
      grid: createEmptyBingoGrid(),
      status: "ERROR" as BingoCardStatus,
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
