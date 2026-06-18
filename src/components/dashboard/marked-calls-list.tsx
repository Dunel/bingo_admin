"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/cn";

export interface MarkedCallsListProps {
  markedCalls: number[];
  onDelete: (numbers: number[]) => Promise<unknown>;
}

export function MarkedCallsList({ markedCalls, onDelete }: MarkedCallsListProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [selected, setSelected] = React.useState<number[]>([]);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setSelected((prev) => prev.filter((v) => markedCalls.includes(v)));
  }, [markedCalls]);

  const allSelected = markedCalls.length > 0 && selected.length === markedCalls.length;

  function toggleOne(n: number) {
    setSelected((prev) =>
      prev.includes(n) ? prev.filter((v) => v !== n) : [...prev, n].sort((a, b) => a - b),
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : [...markedCalls]);
  }

  async function handleDelete(numbers: number[]) {
    if (numbers.length === 0) return;
    const label =
      numbers.length === 1
        ? `el número ${numbers[0]}`
        : `${numbers.length} números seleccionados`;
    const ok = await confirm({
      title: numbers.length === 1 ? "¿Borrar número?" : "¿Borrar números?",
      description: `Vas a borrar ${label}. Se desmarcará de todos los cartones.`,
      confirmText: "Borrar",
      variant: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await onDelete(numbers);
        toast({
          title: "Números borrados",
          description: `Se eliminaron ${numbers.length} número${numbers.length === 1 ? "" : "s"}.`,
          variant: "success",
        });
        setSelected((prev) => prev.filter((v) => !numbers.includes(v)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudieron borrar.";
        toast({ title: "Error", description: message, variant: "error" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Números marcados</CardTitle>
            <CardDescription>
              {markedCalls.length === 0
                ? "Aún no hay números llamados en la ronda."
                : `${markedCalls.length} número${markedCalls.length === 1 ? "" : "s"} en juego.`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              disabled={markedCalls.length === 0 || isPending}
            >
              {allSelected ? "Quitar selección" : "Seleccionar todos"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleDelete(selected)}
              loading={isPending}
              disabled={selected.length === 0}
            >
              Borrar ({selected.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {markedCalls.length === 0 ? (
          <EmptyState
            icon={<InboxIcon className="h-5 w-5" />}
            title="Sin números marcados"
            description="Cuando marques un número, aparecerá aquí para selección masiva y borrado."
          />
        ) : (
          <ul className="stagger flex flex-wrap gap-2">
            {markedCalls.map((value) => {
              const isSelected = selected.includes(value);
              return (
                <li
                  key={value}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border px-1.5 py-1 text-sm font-semibold transition-all",
                    isSelected
                      ? "border-[var(--color-brand-700)] bg-[var(--color-brand-700)] text-white shadow-sm"
                      : "border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:border-[var(--color-brand-400)] hover:bg-[var(--color-brand-50)]",
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-1.5 pl-2 pr-1">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-brand-700)]"
                      checked={isSelected}
                      onChange={() => toggleOne(value)}
                      aria-label={`Seleccionar número ${value}`}
                    />
                    <span>{value}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleDelete([value])}
                    disabled={isPending}
                    className={cn(
                      "rounded-full p-1 transition-colors",
                      isSelected
                        ? "hover:bg-[var(--color-fg-inverse)]/15"
                        : "hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-fg)]",
                    )}
                    aria-label={`Borrar número ${value}`}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 11l3-7h8l3 7v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5zM3 11h4l1 2h4l1-2h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
