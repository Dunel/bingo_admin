import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const cardsCount = await prisma.bingoCard.count({ where: { userId: user.id } });

  return NextResponse.json({ user, cardsCount });
}
