"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "No se pudo iniciar sesión.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#eff6ff_45%,_#ffffff_100%)] p-6 text-zinc-900">
      <section className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-sky-100 bg-white/95 p-8 shadow-xl backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Bingo Admin</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-zinc-600">Ingresa para administrar tus cartas de bingo.</p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-sky-200 bg-white px-4 py-3 outline-none ring-sky-300 transition focus:ring"
              placeholder="usuario@correo.com"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Contraseña</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-sky-200 bg-white px-4 py-3 outline-none ring-sky-300 transition focus:ring"
              placeholder="******"
            />
          </label>

          {error ? <p className="rounded-lg bg-sky-100 px-3 py-2 text-sm text-zinc-800">{error}</p> : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-700">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-semibold text-sky-700 hover:text-sky-600">
            Regístrate
          </Link>
        </p>
      </section>
    </main>
  );
}
