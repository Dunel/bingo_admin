import { NextResponse } from "next/server";
import { hasNumber, type BingoGrid } from "@/lib/bingo";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseValidNumbers(input: unknown): number[] {
  const asArray = Array.isArray(input) ? input : [input];
  const valid = asArray
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 75);

  return [...new Set(valid)].sort((a, b) => a - b);
}

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

  const payload = body as { number?: unknown; numbers?: unknown };
  const numbers = parseValidNumbers(payload.numbers ?? payload.number);

  if (numbers.length === 0) {
    return NextResponse.json({ error: "Debes enviar al menos un número válido entre 1 y 75." }, { status: 400 });
  }

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
    .map((card) => {
      const filtered = card.markedNumbers.filter((value) => !numbers.includes(value));
      const changed = filtered.length !== card.markedNumbers.length;
      return changed ? { id: card.id, markedNumbers: filtered } : null;
    })
    .filter((item): item is { id: string; markedNumbers: number[] } => item !== null);

  if (updates.length > 0) {
    await Promise.all(
      updates.map((item) =>
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
