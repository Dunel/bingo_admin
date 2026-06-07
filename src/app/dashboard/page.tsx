"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import {
  useFigureEngine,
  type FigureMode,
  type FigurePattern,
  createEmptyPattern,
  clonePattern,
  countPatternCells,
  patternKey,
} from "@/hooks/use-figure-engine";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";
import { MarkNumberForm } from "@/components/dashboard/mark-number-form";
import { MarkedCallsList } from "@/components/dashboard/marked-calls-list";
import { FigureEditor, type SavedFigure } from "@/components/dashboard/figure-editor";
import { FigureResults } from "@/components/dashboard/figure-results";
import { CardsGrid } from "@/components/dashboard/cards-grid";

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { me, cards, markedCalls, isLoading, error, actions } = useDashboardData();

  const [figureMode, setFigureMode] = React.useState<FigureMode>("custom");
  const [draft, setDraft] = React.useState<FigurePattern>(() => createEmptyPattern());
  const [savedFigures, setSavedFigures] = React.useState<SavedFigure[]>([]);
  const [selectedFigureIds, setSelectedFigureIds] = React.useState<string[]>([]);
  const lastWinnerIdsRef = React.useRef<Set<string>>(new Set());
  const lastMarkedNumberRef = React.useRef<number | null>(null);
  const lastOneAwayKeysRef = React.useRef<Set<string>>(new Set());

  const isAuthError =
    !!error && (error as Error & { status?: number }).status === 401;

  React.useEffect(() => {
    if (isAuthError) router.replace("/login");
  }, [isAuthError, router]);

  const activePatterns = React.useMemo<FigurePattern[]>(() => {
    const ids = new Set(selectedFigureIds);
    return savedFigures.filter((f) => ids.has(f.id)).map((f) => f.pattern);
  }, [savedFigures, selectedFigureIds]);

  const { matchingCards, matchingCardIds, cellSet, hasSelection, oneAwayCandidates } = useFigureEngine({
    cards,
    mode: figureMode,
    patterns: activePatterns,
  });

  React.useEffect(() => {
    if (matchingCards.length === 0) {
      lastWinnerIdsRef.current = new Set();
      return;
    }
    const currentIds = new Set(matchingCards.map((c) => c.id));
    const previous = lastWinnerIdsRef.current;
    const isNewSet =
      currentIds.size !== previous.size ||
      [...currentIds].some((id) => !previous.has(id));

    if (isNewSet && previous.size > 0) {
      const newIds = [...currentIds].filter((id) => !previous.has(id));
      const newCards = matchingCards.filter((c) => newIds.includes(c.id));
      const cardLabels = newCards.map((c) => c.name ?? `Cartón ${c.id.slice(0, 8)}`);
      const lastMarked = lastMarkedNumberRef.current;
      const prefix = lastMarked ? `Ganaste con el ${lastMarked}: ` : "";
      const description = `${prefix}${cardLabels.join(", ")}`;
      toast({
        title: "¡Bingo!",
        description,
        variant: "winner",
        duration: 6000,
      });
      lastMarkedNumberRef.current = null;
    }
    lastWinnerIdsRef.current = currentIds;
  }, [matchingCards, toast]);

  React.useEffect(() => {
    const currentKeys = new Set(oneAwayCandidates.map((c) => `${c.cardId}|${c.patternKey}`));
    const previous = lastOneAwayKeysRef.current;
    const newKeys = [...currentKeys].filter((k) => !previous.has(k));

    if (newKeys.length > 0 && previous.size > 0) {
      const newOnes = oneAwayCandidates.filter((c) => newKeys.includes(`${c.cardId}|${c.patternKey}`));
      const byCard = new Map<string, typeof newOnes>();
      for (const item of newOnes) {
        const list = byCard.get(item.cardId) ?? [];
        list.push(item);
        byCard.set(item.cardId, list);
      }
      for (const [cardId, items] of byCard) {
        const cardLabel = items[0].cardName ?? `Cartón ${cardId.slice(0, 8)}`;
        const descriptions = items.map((i) =>
          `Con el ${i.missingNumber} ganas ${i.patternKey === "full" ? "el cartón lleno" : `la ${i.patternLabel}`}.`,
        );
        toast({
          title: `¡Casi! ${cardLabel}`,
          description: descriptions.join(" "),
          variant: "info",
          duration: 6000,
        });
      }
    }
    lastOneAwayKeysRef.current = currentKeys;
  }, [oneAwayCandidates, toast]);

  const draftCellCount = React.useMemo(() => countPatternCells(draft), [draft]);

  const isFigureCell = React.useCallback(
    (row: number, col: number) => cellSet.has(`${row}-${col}`),
    [cellSet],
  );

  const figureFilterActive = figureMode === "custom" && selectedFigureIds.length > 0;

  function toggleCell(row: number, col: number) {
    setDraft((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return next;
    });
  }

  function clearDraft() {
    setDraft(createEmptyPattern());
  }

  function addFigure() {
    if (draftCellCount === 0) return;
    const next = clonePattern(draft);
    const key = patternKey(next);
    if (savedFigures.some((f) => patternKey(f.pattern) === key)) {
      toast({
        title: "Figura duplicada",
        description: "Ya tienes esa figura guardada.",
        variant: "warning",
      });
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name = `Figura ${savedFigures.length + 1}`;
    setSavedFigures((prev) => [...prev, { id, name, pattern: next }]);
    setSelectedFigureIds((prev) => [...prev, id]);
    setDraft(createEmptyPattern());
  }

  function toggleFigureSelection(id: string) {
    setSelectedFigureIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function removeFigure(id: string) {
    setSavedFigures((prev) => prev.filter((f) => f.id !== id));
    setSelectedFigureIds((prev) => prev.filter((x) => x !== id));
  }

  async function handleMarkNumber(number: number) {
    lastMarkedNumberRef.current = number;
    return actions.markNumber(number);
  }

  function handleScrollToCard(cardId: string) {
    const element = document.getElementById(`card-${cardId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (isAuthError) return null;

  if (error && !isAuthError) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Card className="p-6 text-center">
          <p className="font-semibold text-[var(--color-danger-fg)]">
            {(error as Error).message}
          </p>
        </Card>
      </main>
    );
  }

  if (isLoading || !me) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <DashboardHeader
        username={me.user.username}
        email={me.user.email}
        cardsCount={me.cardsCount}
        isAdmin={me.user.role === "ADMIN"}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <MarkNumberForm
            onMark={handleMarkNumber}
            oneAwayCandidates={oneAwayCandidates}
            onScrollToCard={handleScrollToCard}
          />
          <FigureEditor
            mode={figureMode}
            onModeChange={setFigureMode}
            draft={draft}
            onToggleCell={toggleCell}
            onClearDraft={clearDraft}
            onAddFigure={addFigure}
            savedFigures={savedFigures}
            selectedFigureIds={selectedFigureIds}
            onToggleFigureSelection={toggleFigureSelection}
            onRemoveFigure={removeFigure}
            draftCellCount={draftCellCount}
          />
        </div>
        <div className="space-y-6">
          <MarkedCallsList
            markedCalls={markedCalls}
            onDelete={actions.deleteMarkedNumbers}
          />
          <FigureResults
            matchingCards={matchingCards}
            mode={figureMode}
            hasSelection={hasSelection}
          />
        </div>
      </div>

      <CardsGrid
        cards={cards}
        matchingCardIds={matchingCardIds}
        isFigureCell={isFigureCell}
        figureFilterActive={figureFilterActive}
        onDeleteCard={actions.deleteCard}
        onDeleteAll={actions.deleteAllCards}
      />
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-28 w-full rounded-[var(--radius-xl)]" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </main>
  );
}
