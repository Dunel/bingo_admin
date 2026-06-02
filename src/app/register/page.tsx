"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type MeResponse = {
  user: { role: "ADMIN" | "USER" };
};

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validateAccess() {
      try {
        const response = await fetch("/api/me");
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        const payload = (await response.json()) as MeResponse;
        if (payload.user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        if (!cancelled) setIsAdmin(true);
      } catch {
        if (!cancelled) router.replace("/login");
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    }

    void validateAccess();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      setError("Solo administradores pueden registrar usuarios.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload.error ?? "No se pudo registrar.";
          setError(message);
          toast({ title: "Error al registrar", description: message, variant: "error" });
          return;
        }
        toast({ title: "Usuario creado", description: `${username || email} ya puede iniciar sesión.`, variant: "success" });
        router.push("/login");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        toast({ title: "Error", description: message, variant: "error" });
      }
    });
  }

  if (checkingAccess) {
    return (
      <AuthShell title="Crear cuenta" subtitle="Validando permisos...">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthShell>
    );
  }

  if (!isAdmin) return null;

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Registra un nuevo usuario administrador."
      footer={
        <span>
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)] underline-offset-2 hover:underline dark:text-[var(--color-brand-300)]"
          >
            Inicia sesión
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email" required>
            Email
          </Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={!!error}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-username">Username (opcional)</Label>
          <Input
            id="reg-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-password" required>
            Contraseña
          </Label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={!!error}
          />
          <p className="text-xs text-[var(--color-fg-subtle)]">Mínimo 6 caracteres.</p>
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
          {isPending ? "Creando..." : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}
