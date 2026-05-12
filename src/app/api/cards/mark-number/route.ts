import { NextResponse } from "next/server";
import { hasNumber, type BingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteMarkedNumbersBodySchema, markNumberBodySchema } from "@/lib/validations/cards";

type CardForMark = {
  id: string;
  correctedGrid: unknown;
  markedNumbers: number[];
};

type CardForUnmark = {
  id: string;
  markedNumbers: number[];
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const calls = await prisma.userMarkedCall.findMany({
    where: { userId: user.id },
    orderBy: { number: "asc" },
    select: { number: true },
  });

  return NextResponse.json({ markedNumbers: calls.map((item: { number: number }) => item.number) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Debes enviar un cuerpo JSON válido." }, { status: 400 });
  }

  const parsed = markNumberBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { number } = parsed.data;

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

  const toUpdate = cards.filter((card: CardForMark) => {
    const grid = card.correctedGrid as BingoGrid | null;
    if (!grid) {
      return false;
    }

    return hasNumber(grid, number) && !card.markedNumbers.includes(number);
  });

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((card: CardForMark) =>
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
    updatedCardIds: toUpdate.map((card: CardForMark) => card.id),
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Debes enviar un cuerpo JSON válido." }, { status: 400 });
  }

  const parsed = deleteMarkedNumbersBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { numbers } = parsed.data;

  const deletedCalls = await prisma.userMarkedCall.deleteMany({
    where: {
      userId: user.id,
      number: { in: numbers },
    },
  });

  const cards = await prisma.bingoCard.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      markedNumbers: true,
    },
  });

  const updates = cards
    .map((card: CardForUnmark) => {
      const filtered = card.markedNumbers.filter((value) => !numbers.includes(value));
      const changed = filtered.length !== card.markedNumbers.length;
      return changed ? { id: card.id, markedNumbers: filtered } : null;
    })
    .filter((item: { id: string; markedNumbers: number[] } | null): item is { id: string; markedNumbers: number[] } => item !== null);

  if (updates.length > 0) {
    await Promise.all(
      updates.map((item: { id: string; markedNumbers: number[] }) =>
        prisma.bingoCard.update({
          where: { id: item.id },
          data: { markedNumbers: { set: item.markedNumbers } },
          select: { id: true },
        }),
      ),
    );
  }

  const remainingCalls = await prisma.userMarkedCall.findMany({
    where: { userId: user.id },
    orderBy: { number: "asc" },
    select: { number: true },
  });

  return NextResponse.json({
    removedNumbers: numbers,
    removedCount: deletedCalls.count,
    updatedCardsCount: updates.length,
    markedNumbers: remainingCalls.map((item: { number: number }) => item.number),
  });
}
