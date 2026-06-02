"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload.error ?? "No se pudo iniciar sesión.";
          setError(message);
          toast({ title: "Error de inicio de sesión", description: message, variant: "error" });
          return;
        }
        toast({ title: "Bienvenido de vuelta", variant: "success" });
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        toast({ title: "Error", description: message, variant: "error" });
      }
    });
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Ingresa para administrar tus cartas de bingo."
      footer={
        <span>
          ¿No tienes cuenta? Contacta al administrador.{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)] underline-offset-2 hover:underline dark:text-[var(--color-brand-300)]"
          >
            Más información
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@correo.com"
            invalid={!!error}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            invalid={!!error}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-fg)] animate-fade-in"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={isPending} fullWidth size="lg">
          {isPending ? "Ingresando..." : "Entrar"}
        </Button>

        <p className="text-center text-xs text-[var(--color-fg-subtle)]">
          La creación de cuentas está disponible solo desde la administración.
        </p>
      </form>
    </AuthShell>
  );
}
