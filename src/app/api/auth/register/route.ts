import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerBodySchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo un administrador puede registrar usuarios." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Debes enviar un cuerpo JSON válido." }, { status: 400 });
    }

    const parsed = registerBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
    }

    const { email, username, password } = parsed.data;

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
