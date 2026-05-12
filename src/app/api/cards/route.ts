import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCardFormSchema } from "@/lib/validations/cards";

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
  const parsed = createCardFormSchema.safeParse({
    image: formData.get("image"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { image: file, name } = parsed.data;

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
