import { NextResponse } from "next/server";
import { hasNumber, type BingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markNumberBodySchema } from "@/lib/validations/cards";
import { idParamSchema } from "@/lib/validations/common";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsedParams = idParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: parsedParams.error.issues[0]?.message ?? "ID inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Debes enviar un cuerpo JSON válido." }, { status: 400 });
  }

  const parsedBody = markNumberBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { id } = parsedParams.data;
  const { number } = parsedBody.data;

  const card = await prisma.bingoCard.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      correctedGrid: true,
      markedNumbers: true,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Carta no encontrada." }, { status: 404 });
  }

  const grid = card.correctedGrid as BingoGrid | null;

  if (!grid) {
    return NextResponse.json({ error: "La carta aún no ha sido procesada." }, { status: 400 });
  }

  if (!hasNumber(grid, number)) {
    return NextResponse.json({ found: false, markedNumbers: card.markedNumbers });
  }

  if (card.markedNumbers.includes(number)) {
    return NextResponse.json({ found: true, alreadyMarked: true, markedNumbers: card.markedNumbers });
  }

  await prisma.userMarkedCall.upsert({
    where: {
      userId_number: {
        userId: user.id,
        number,
      },
    },
    update: {},
    create: {
      userId: user.id,
      number,
    },
    select: { id: true },
  });

  const updated = await prisma.bingoCard.update({
    where: { id },
    data: {
      markedNumbers: {
        push: number,
      },
    },
    select: {
      markedNumbers: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ found: true, alreadyMarked: false, markedNumbers: updated.markedNumbers });
}
