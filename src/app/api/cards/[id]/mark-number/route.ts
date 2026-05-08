import { NextResponse } from "next/server";
import { hasNumber, type BingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json();
  const number = Number(body?.number);

  if (!Number.isInteger(number) || number < 1 || number > 75) {
    return NextResponse.json({ error: "Número inválido. Debe estar entre 1 y 75." }, { status: 400 });
  }

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
