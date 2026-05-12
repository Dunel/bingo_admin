import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { computeMarkedNumbersForGrid } from "@/lib/marked-calls";
import { prisma } from "@/lib/prisma";
import { cardGridPatchBodySchema } from "@/lib/validations/cards";
import { idParamSchema } from "@/lib/validations/common";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
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

  const parsedBody = cardGridPatchBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "La grilla enviada no es válida." }, { status: 400 });
  }

  const { id } = parsedParams.data;
  const { grid } = parsedBody.data;

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
  const globalMarkedNumbers = globalMarked.map((item: { number: number }) => item.number);

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
