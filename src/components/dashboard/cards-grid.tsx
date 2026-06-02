"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { CardTile } from "./card-tile";
import type { Card as CardType } from "@/hooks/use-dashboard-data";

export interface CardsGridProps {
  cards: CardType[];
  matchingCardIds: Set<string>;
  isFigureCell: (row: number, col: number) => boolean;
  figureFilterActive: boolean;
  onDeleteCard: (id: string) => Promise<unknown>;
  onDeleteAll: () => Promise<unknown>;
}

export function CardsGrid({
  cards,
  matchingCardIds,
  isFigureCell,
  figureFilterActive,
  onDeleteCard,
  onDeleteAll,
}: CardsGridProps) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletingAll, setDeletingAll] = React.useState(false);

  async function handleDeleteCard(id: string) {
    const ok = await confirm({
      title: "¿Eliminar este cartón?",
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      await onDeleteCard(id);
      toast({ title: "Cartón eliminado", variant: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar.";
      toast({ title: "Error", description: message, variant: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: `¿Eliminar los ${cards.length} cartones?`,
      description: "Se borrarán TODOS tus cartones. Esta acción no se puede deshacer.",
      confirmText: "Eliminar todos",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingAll(true);
    try {
      const result = (await onDeleteAll()) as { deletedCount?: number };
      toast({
        title: "Cartones eliminados",
        description: `${result.deletedCount ?? cards.length} cartones borrados.`,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar.";
      toast({ title: "Error", description: message, variant: "error" });
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Tus cartas</CardTitle>
            <CardDescription>
              {cards.length === 0
                ? "Crea tu primera carta para empezar."
                : `${cards.length} cartón${cards.length === 1 ? "" : "es"} en total.`}
            </CardDescription>
          </div>
          {cards.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDeleteAll()}
              loading={deletingAll}
              disabled={deletingId !== null}
            >
              {deletingAll ? "Eliminando..." : "Eliminar todos"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        {cards.length === 0 ? (
          <EmptyState
            icon={<CardsIcon className="h-5 w-5" />}
            title="Aún no tienes cartones"
            description="Sube una imagen de un cartón para extraer la grilla con IA."
            action={
              <a
                href="/cards/new"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                <PlusIcon className="h-4 w-4" />
                Crear primera carta
              </a>
            }
          />
        ) : (
          <ul
            className={cn(
              "stagger grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3",
              matchingCardIds.size > 0 && "lg:grid-cols-2 xl:grid-cols-3",
            )}
          >
            {cards.map((card) => (
              <li key={card.id}>
                <CardTile
                  card={card}
                  isWinner={matchingCardIds.has(card.id)}
                  figureFilterActive={figureFilterActive}
                  isFigureCell={isFigureCell}
                  onDelete={(id) => void handleDeleteCard(id)}
                  isDeleting={deletingId === card.id}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function CardsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="3" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7" y="6" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
