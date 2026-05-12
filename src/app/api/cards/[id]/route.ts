import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idParamSchema } from "@/lib/validations/common";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
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
      name: true,
      status: true,
      detectedGrid: true,
      correctedGrid: true,
      markedNumbers: true,
      sourceImageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Carta no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ card });
}

export async function DELETE(_: Request, { params }: Params) {
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
    select: { id: true },
  });

  if (!card) {
    return NextResponse.json({ error: "Carta no encontrada." }, { status: 404 });
  }

  await prisma.bingoCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
