"use client";

import * as React from "react";
import Link from "next/link";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type CardPayload = {
  card: {
    id: string;
    name: string | null;
    status: "UPLOADED" | "PROCESSED" | "ERROR";
    sourceImageUrl: string;
    correctedGrid: (number | null)[][] | null;
    markedNumbers: number[];
  };
};

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_LABEL: Record<"UPLOADED" | "PROCESSED" | "ERROR", string> = {
  PROCESSED: "Procesada",
  UPLOADED: "Subida",
  ERROR: "Con error",
};
const STATUS_VARIANT: Record<"UPLOADED" | "PROCESSED" | "ERROR", "success" | "info" | "danger"> = {
  PROCESSED: "success",
  UPLOADED: "info",
  ERROR: "danger",
};

export default function CardDetailPage({ params }: Props) {
  const { toast } = useToast();
  const [cardId, setCardId] = React.useState<string>("");
  const [sourceImageUrl, setSourceImageUrl] = React.useState("");
  const [cardName, setCardName] = React.useState<string | null>(null);
  const [grid, setGrid] = React.useState<(number | null)[][]>([]);
  const [editableGrid, setEditableGrid] = React.useState<(number | null)[][]>([]);
  const [markedNumbers, setMarkedNumbers] = React.useState<number[]>([]);
  const [status, setStatus] = React.useState<"UPLOADED" | "PROCESSED" | "ERROR" | "">("");
  const [editing, setEditing] = React.useState(false);
  const [savingGrid, setSavingGrid] = React.useState(false);
  const [numberInput, setNumberInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { actions } = useDashboardData();

  React.useEffect(() => {
    let cancelled = false;
    void params.then((value) => {
      if (!cancelled) setCardId(value.id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  React.useEffect(() => {
    if (!cardId) return;
    void loadCard(cardId);
  }, [cardId]);

  async function loadCard(id: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${id}`);
      const payload = (await response.json()) as CardPayload;
      if (!response.ok) {
        setError("No se pudo cargar la carta.");
        return;
      }
      setStatus(payload.card.status);
      setCardName(payload.card.name);
      setGrid(payload.card.correctedGrid ?? []);
      setEditableGrid(payload.card.correctedGrid ?? []);
      setMarkedNumbers(payload.card.markedNumbers ?? []);
      setSourceImageUrl(payload.card.sourceImageUrl ?? "");
    } finally {
      setLoading(false);
    }
  }

  const markedSet = React.useMemo(() => new Set(markedNumbers), [markedNumbers]);

  function onGridCellChange(rowIndex: number, colIndex: number, rawValue: string) {
    setEditableGrid((previous) => {
      const next = previous.map((row) => [...row]);
      if (!next[rowIndex] || next[rowIndex][colIndex] === undefined) return previous;
      if (rowIndex === 2 && colIndex === 2) {
        next[rowIndex][colIndex] = null;
        return next;
      }
      const parsed = Number(rawValue);
      if (!rawValue || !Number.isInteger(parsed) || parsed < 1 || parsed > 75) {
        next[rowIndex][colIndex] = null;
        return next;
      }
      next[rowIndex][colIndex] = parsed;
      return next;
    });
  }

  async function saveGrid() {
    if (!cardId) return;
    setSavingGrid(true);
    try {
      const response = await fetch(`/api/cards/${cardId}/grid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: editableGrid }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ title: "Error", description: payload.error ?? "No se pudo guardar la grilla.", variant: "error" });
        return;
      }
      setGrid(payload.card.correctedGrid ?? editableGrid);
      setEditing(false);
      toast({ title: "Grilla actualizada", variant: "success" });
    } finally {
      setSavingGrid(false);
    }
  }

  async function markNumber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(numberInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 75) {
      toast({ title: "Número inválido", description: "Debe estar entre 1 y 75.", variant: "error" });
      return;
    }
    if (!cardId) return;
    try {
      const response = await fetch(`/api/cards/${cardId}/mark-number`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: parsed }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ title: "Error", description: payload.error ?? "No se pudo marcar.", variant: "error" });
        return;
      }
      setMarkedNumbers(payload.markedNumbers ?? []);
      if (!payload.found) {
        toast({ title: "No encontrado", description: `El número ${parsed} no está en esta carta.`, variant: "warning" });
        return;
      }
      if (payload.alreadyMarked) {
        toast({ title: "Ya marcado", description: `El número ${parsed} ya estaba marcado.`, variant: "info" });
        return;
      }
      toast({ title: "Número marcado", description: `Se marcó el ${parsed}.`, variant: "success" });
      setNumberInput("");
      await actions.refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "Error", description: message, variant: "error" });
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Card className="p-6 text-center">
          <p className="font-semibold text-[var(--color-danger-fg)]">{error}</p>
          <Link href="/dashboard" className="mt-3 inline-block">
            <Button variant="primary" size="sm">
              Volver al panel
            </Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
            Carta
          </p>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-fg)]">
            {cardName ?? "Detalle de la carta"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-fg-muted)]">
            <span>Estado:</span>
            {status ? <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge> : null}
            <span className="text-[var(--color-fg-subtle)]">· Marcados: {markedNumbers.length}</span>
          </div>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeftIcon className="h-4 w-4" />}>
            Volver al panel
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Grilla de bingo</CardTitle>
                <CardDescription>
                  {editing ? "Edita los números y guarda al terminar." : "Vista actual de la grilla."}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant={editing ? "ghost" : "outline"}
                onClick={() => {
                  if (editing) {
                    setEditableGrid(grid);
                    setEditing(false);
                  } else {
                    setEditableGrid(grid);
                    setEditing(true);
                  }
                }}
              >
                {editing ? "Cancelar" : "Editar números"}
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {grid.length === 0 ? (
              <EmptyState
                icon={<GridIcon className="h-5 w-5" />}
                title="Sin grilla"
                description="Esta carta aún no tiene grilla procesada."
              />
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                  {(editing ? editableGrid : grid).flatMap((row, rowIndex) =>
                    row.map((value, colIndex) => {
                      const isMarked = value !== null && markedSet.has(value);
                      const isCenterFree = rowIndex === 2 && colIndex === 2;
                      const isEmpty = value === null && !isCenterFree;

                      return (
                        <div key={`${rowIndex}-${colIndex}`} className="aspect-square">
                          {editing && !isCenterFree ? (
                            <input
                              type="number"
                              min={1}
                              max={75}
                              value={value ?? ""}
                              onChange={(event) => onGridCellChange(rowIndex, colIndex, event.target.value)}
                              className="h-full w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-center text-base font-bold text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                            />
                          ) : (
                            <div
                              className={cn(
                                "flex h-full w-full items-center justify-center rounded-[var(--radius-md)] border text-base font-bold transition-all",
                                isCenterFree
                                  ? "border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
                                  : isMarked
                                    ? "border-[var(--color-bingo-marked)] bg-[var(--color-bingo-marked-bg)] text-[var(--color-bingo-winner-fg)] shadow-[0_0_0_2px_var(--color-bingo-winner-ring)]"
                                    : isEmpty
                                      ? "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]"
                                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]",
                              )}
                            >
                              {isCenterFree ? "FREE" : value ?? "-"}
                            </div>
                          )}
                        </div>
                      );
                    }),
                  )}
                </div>
                {editing ? (
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditableGrid(grid); setEditing(false); }}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" onClick={saveGrid} loading={savingGrid}>
                      {savingGrid ? "Guardando..." : "Guardar grilla"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagen original</CardTitle>
            </CardHeader>
            <CardBody>
              {sourceImageUrl ? (
                <img
                  src={sourceImageUrl}
                  alt="Carta de bingo"
                  className="max-h-56 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] object-contain bg-[var(--color-surface-2)]"
                />
              ) : (
                <EmptyState title="Sin imagen" description="No hay imagen disponible." />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Marcar número</CardTitle>
              <CardDescription>Ingresa un número entre 1 y 75.</CardDescription>
            </CardHeader>
            <CardBody>
              <form className="space-y-3" onSubmit={markNumber}>
                <div className="space-y-1.5">
                  <Label htmlFor="mark-card-number" className="sr-only">
                    Número
                  </Label>
                  <Input
                    id="mark-card-number"
                    type="number"
                    min={1}
                    max={75}
                    value={numberInput}
                    onChange={(event) => setNumberInput(event.target.value)}
                    placeholder="Ej: 42"
                    inputMode="numeric"
                  />
                </div>
                <Button type="submit" fullWidth>
                  Marcar
                </Button>
              </form>

              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  Números marcados
                </p>
                {markedNumbers.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">Sin números</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {markedNumbers.map((n) => (
                      <li
                        key={n}
                        className="rounded-full bg-[var(--color-bingo-marked-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-bingo-winner-fg)] ring-1 ring-[var(--color-bingo-winner)]/30"
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-96 w-full" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </main>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 4l-6 6 6 6M6 10h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="15" y="2" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="8.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="15" y="8.5" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="15" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="15" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="15" y="15" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
