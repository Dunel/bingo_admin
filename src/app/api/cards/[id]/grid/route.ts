import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { computeMarkedNumbersForGrid } from "@/lib/marked-calls";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

type GridPayload = (number | null)[][];

function isValidGrid(grid: unknown): grid is GridPayload {
  if (!Array.isArray(grid) || grid.length !== 5) {
    return false;
  }

  for (let row = 0; row < 5; row += 1) {
    const rowData = grid[row];
    if (!Array.isArray(rowData) || rowData.length !== 5) {
      return false;
    }

    for (let col = 0; col < 5; col += 1) {
      const value = rowData[col];

      if (row === 2 && col === 2 && value !== null) {
        return false;
      }

      if (value !== null && (!Number.isInteger(value) || value < 1 || value > 75)) {
        return false;
      }
    }
  }

  return true;
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const grid = body?.grid;

  if (!isValidGrid(grid)) {
    return NextResponse.json({ error: "La grilla enviada no es válida." }, { status: 400 });
  }

  const card = await prisma.bingoCard.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
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

  const updated = await prisma.bingoCard.update({
    where: { id },
    data: {
      correctedGrid: grid,
      status: "PROCESSED",
      markedNumbers: computeMarkedNumbersForGrid(grid, globalMarkedNumbers),
    },
    select: {
      id: true,
      status: true,
      correctedGrid: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ card: updated });
}
