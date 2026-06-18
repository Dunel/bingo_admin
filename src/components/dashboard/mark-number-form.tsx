"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { OneAwayCandidate } from "@/hooks/use-figure-engine";

export interface MarkNumberFormProps {
  onMark: (number: number) => Promise<{ updatedCount: number }>;
  oneAwayCandidates?: OneAwayCandidate[];
  onScrollToCard?: (cardId: string) => void;
  disabled?: boolean;
}

export function MarkNumberForm({ onMark, oneAwayCandidates = [], onScrollToCard, disabled }: MarkNumberFormProps) {
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

  const candidatesByCard = React.useMemo(() => {
    const map = new Map<string, OneAwayCandidate[]>();
    for (const candidate of oneAwayCandidates) {
      const list = map.get(candidate.cardId) ?? [];
      list.push(candidate);
      map.set(candidate.cardId, list);
    }
    return map;
  }, [oneAwayCandidates]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-800)] dark:text-[var(--color-brand-200)]">
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
      <CardBody className="space-y-4">
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

        {candidatesByCard.size > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-fg)]">
              Números que te hacen ganar:
            </p>
            <ul className="space-y-1.5">
              {Array.from(candidatesByCard.entries()).map(([cardId, candidates]) => {
                const cardName = candidates[0].cardName ?? `Cartón ${cardId.slice(0, 8)}`;
                return candidates.map((candidate, idx) => (
                  <li key={`${cardId}-${candidate.patternKey}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => onScrollToCard?.(cardId)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-3)]",
                      )}
                    >
                      <span className="flex-1">
                        Con el <span className="font-bold text-[var(--color-brand-700)]">{candidate.missingNumber}</span> ganas con <span className="font-semibold">{cardName}</span>
                        {candidate.patternKey !== "full" ? ` (${candidate.patternLabel})` : " (cartón lleno)"}
                      </span>
                      <ArrowRightIcon className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                    </button>
                  </li>
                ));
              })}
            </ul>
          </div>
        ) : null}
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
