import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const username = String(body?.username ?? "").trim() || null;
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : []),
        ],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email o username." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        // MVP: en produccion usar hash real (bcrypt/argon2)
        passwordHash: password,
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el usuario." }, { status: 500 });
  }
}
