"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export interface MarkNumberFormProps {
  onMark: (number: number) => Promise<{ updatedCount: number }>;
  disabled?: boolean;
}

export function MarkNumberForm({ onMark, disabled }: MarkNumberFormProps) {
  const { toast } = useToast();
  const [value, setValue] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 75) {
      toast({ title: "Número inválido", description: "Debe estar entre 1 y 75.", variant: "error" });
      return;
    }

    startTransition(async () => {
      try {
        const { updatedCount } = await onMark(parsed);
        if (updatedCount === 0) {
          toast({
            title: `Número ${parsed}`,
            description: "No se encontró en ningún cartón.",
            variant: "warning",
          });
        } else {
          toast({
            title: `Número ${parsed} marcado`,
            description: `Se agregó en ${updatedCount} cartón${updatedCount === 1 ? "" : "es"}.`,
            variant: "success",
          });
        }
        setValue("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo marcar el número.";
        toast({ title: "Error", description: message, variant: "error" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-200)]">
            <HashIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Marcar número en todos los cartones</CardTitle>
            <CardDescription>
              Llama un número (1-75) y se resaltará en todos tus cartones automáticamente.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="mark-number" className="sr-only">
              Número
            </Label>
            <Input
              id="mark-number"
              type="number"
              min={1}
              max={75}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Ej: 42"
              className="text-base"
              inputMode="numeric"
            />
          </div>
          <Button
            type="submit"
            loading={isPending}
            disabled={disabled}
            size="lg"
            leftIcon={<HashIcon className="h-4 w-4" />}
            className="sm:w-auto w-full"
          >
            {isPending ? "Marcando..." : "Marcar en todos"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 2l-2 16M15 2l-2 16M3 7h14M2 13h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
