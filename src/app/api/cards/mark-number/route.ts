import { NextResponse } from "next/server";
import { hasNumber, type BingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const number = Number(body?.number);

  if (!Number.isInteger(number) || number < 1 || number > 75) {
    return NextResponse.json({ error: "Número inválido. Debe estar entre 1 y 75." }, { status: 400 });
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

  const cards = await prisma.bingoCard.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      correctedGrid: true,
      markedNumbers: true,
    },
  });

  const toUpdate = cards.filter((card) => {
    const grid = card.correctedGrid as BingoGrid | null;
    if (!grid) {
      return false;
    }

    return hasNumber(grid, number) && !card.markedNumbers.includes(number);
  });

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((card) =>
        prisma.bingoCard.update({
          where: { id: card.id },
          data: {
            markedNumbers: {
              push: number,
            },
          },
          select: { id: true },
        }),
      ),
    );
  }

  return NextResponse.json({
    number,
    updatedCount: toUpdate.length,
    totalCards: cards.length,
    updatedCardIds: toUpdate.map((card) => card.id),
  });
}
