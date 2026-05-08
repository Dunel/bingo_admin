import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_MIMES = new Set(["image/jpg", "image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CARD_NAME_LENGTH = 80;

function normalizeCardName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_CARD_NAME_LENGTH);
}

function toPrismaMimeType(mime: string): "IMAGE_JPG" | "IMAGE_JPEG" | "IMAGE_PNG" {
  if (mime === "image/jpg") return "IMAGE_JPG";
  if (mime === "image/jpeg") return "IMAGE_JPEG";
  return "IMAGE_PNG";
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const cards = await prisma.bingoCard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      sourceMimeType: true,
      correctedGrid: true,
      markedNumbers: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ cards });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("image");
  const name = normalizeCardName(formData.get("name"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes subir una imagen." }, { status: 400 });
  }

  if (!VALID_MIMES.has(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Usa jpg, jpeg o png." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "La imagen excede 5 MB." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const card = await prisma.bingoCard.create({
    data: {
      userId: user.id,
      name,
      sourceImageUrl: dataUrl,
      sourceMimeType: toPrismaMimeType(file.type),
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ card }, { status: 201 });
}

export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const result = await prisma.bingoCard.deleteMany({
    where: { userId: user.id },
  });

  return NextResponse.json({ ok: true, deletedCount: result.count });
}
