import { NextResponse } from "next/server";
import { extractBingoGridFromDataUrl, type OcrCropRect } from "@/lib/ocr";

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const mode = formData.get("mode") as string | null;

  if (!image) {
    return NextResponse.json({ error: "No se proporcionó una imagen." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowedTypes.includes(image.type)) {
    return NextResponse.json({ error: "Formato no soportado. Usa JPG o PNG." }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${image.type};base64,${base64}`;

    const cardCount = mode === "x2" ? 2 : mode === "x4" ? 4 : mode === "x6" ? 6 : 1;

    if (cardCount === 1) {
      const result = await extractBingoGridFromDataUrl(dataUrl);
      const elapsed = Date.now() - startTime;

      if (!result) {
        return NextResponse.json({
          success: false,
          cards: [],
          error: "No se detectaron números en la imagen.",
          elapsed,
        });
      }

      const allNumbers: number[] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (result.grid[r][c] !== null) {
            allNumbers.push(result.grid[r][c] as number);
          }
        }
      }

      return NextResponse.json({
        success: true,
        cards: [
          {
            index: 1,
            success: true,
            grid: result.grid,
            confidence: result.confidence,
            extractedCount: result.extractedCount,
            numbers: allNumbers.sort((a, b) => a - b),
          },
        ],
        elapsed,
      });
    }

    // Multi-card mode: dividir la imagen en partes iguales
    const cropRects = generateCropRects(cardCount);
    
    const results = await Promise.all(
      cropRects.map((rect) => extractBingoGridFromDataUrl(dataUrl, rect)),
    );

    const elapsed = Date.now() - startTime;
    const cards = results.map((result, index) => {
      if (!result) {
        return {
          index: index + 1,
          success: false,
          grid: null,
          confidence: 0,
          extractedCount: 0,
          numbers: [],
          error: "No se detectaron números",
        };
      }

      const allNumbers: number[] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (result.grid[r][c] !== null) {
            allNumbers.push(result.grid[r][c] as number);
          }
        }
      }

      return {
        index: index + 1,
        success: true,
        grid: result.grid,
        confidence: result.confidence,
        extractedCount: result.extractedCount,
        numbers: allNumbers.sort((a, b) => a - b),
      };
    });

    return NextResponse.json({
      success: true,
      cards,
      elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, cards: [], error: message, elapsed }, { status: 500 });
  }
}

function generateCropRects(count: number): OcrCropRect[] {
  if (count === 2) {
    // 2 cartones: dividir horizontalmente
    return [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ];
  }
  
  if (count === 4) {
    // 4 cartones: 2x2
    return [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ];
  }
  
  if (count === 6) {
    // 6 cartones: 3x2
    return [
      { x: 0, y: 0, width: 1/3, height: 0.5 },
      { x: 1/3, y: 0, width: 1/3, height: 0.5 },
      { x: 2/3, y: 0, width: 1/3, height: 0.5 },
      { x: 0, y: 0.5, width: 1/3, height: 0.5 },
      { x: 1/3, y: 0.5, width: 1/3, height: 0.5 },
      { x: 2/3, y: 0.5, width: 1/3, height: 0.5 },
    ];
  }
  
  return [{ x: 0, y: 0, width: 1, height: 1 }];
}
