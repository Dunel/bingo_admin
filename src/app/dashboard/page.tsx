"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MeResponse = {
  user: {
    id: string;
    email: string;
    username: string | null;
    role: "ADMIN" | "USER";
  };
  cardsCount: number;
};

type Card = {
  id: string;
  name: string | null;
  status: "UPLOADED" | "PROCESSED" | "ERROR";
  sourceMimeType: "IMAGE_JPG" | "IMAGE_JPEG" | "IMAGE_PNG";
  correctedGrid: (number | null)[][] | null;
  markedNumbers: number[];
  createdAt: string;
};

type FigureMode = "custom" | "full";
type SavedFigure = {
  id: string;
  name: string;
  pattern: boolean[][];
};

function createEmptyFigurePattern() {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => false));
}

function clonePattern(pattern: boolean[][]): boolean[][] {
  return pattern.map((row) => [...row]);
}

function countPatternCells(pattern: boolean[][]): number {
  return pattern.reduce((sum, row) => sum + row.filter((value) => value).length, 0);
}

function patternKey(pattern: boolean[][]): string {
  return pattern.map((row) => row.map((value) => (value ? "1" : "0")).join("")).join("|");
}

function isCardCellMarked(card: Card, rowIndex: number, colIndex: number): boolean {
  if (rowIndex === 2 && colIndex === 2) {
    return true;
  }

  const value = card.correctedGrid?.[rowIndex]?.[colIndex] ?? null;
  if (value === null) {
    return false;
  }

  return card.markedNumbers.includes(value);
}

function cardMatchesFigure(card: Card, pattern: boolean[][]): boolean {
  if (!card.correctedGrid) {
    return false;
  }

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!pattern[row]?.[col]) {
        continue;
      }

      if (!isCardCellMarked(card, row, col)) {
        return false;
      }
    }
  }

  return true;
}

function cardMatchesAnyFigure(card: Card, patterns: boolean[][][]): boolean {
  return patterns.some((pattern) => cardMatchesFigure(card, pattern));
}

function cardIsFull(card: Card): boolean {
  if (!card.correctedGrid) {
    return false;
  }

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!isCardCellMarked(card, row, col)) {
        return false;
      }
    }
  }

  return true;
}

function getStatusLabel(status: Card["status"]) {
  if (status === "PROCESSED") return "Procesada";
  if (status === "UPLOADED") return "Subida";
  return "Con error";
}

function getStatusClassName(status: Card["status"]) {
  if (status === "PROCESSED") return "border-sky-300 bg-sky-100 text-zinc-900";
  if (status === "UPLOADED") return "border-zinc-300 bg-zinc-100 text-zinc-900";
  return "border-zinc-900 bg-zinc-900 text-white";
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [markedCalls, setMarkedCalls] = useState<number[]>([]);
  const [selectedMarkedCalls, setSelectedMarkedCalls] = useState<number[]>([]);
  const [deletingMarkedCalls, setDeletingMarkedCalls] = useState(false);
  const [markedCallsMessage, setMarkedCallsMessage] = useState<string | null>(null);
  const [figureMode, setFigureMode] = useState<FigureMode>("custom");
  const [figurePattern, setFigurePattern] = useState<boolean[][]>(() => createEmptyFigurePattern());
  const [savedFigures, setSavedFigures] = useState<SavedFigure[]>([]);
  const [selectedFigureIds, setSelectedFigureIds] = useState<string[]>([]);

  const currentFigureCells = useMemo(
    () => figurePattern.reduce((sum, row) => sum + row.filter((value) => value).length, 0),
    [figurePattern],
  );

  const selectedFigureIdSet = useMemo(() => new Set(selectedFigureIds), [selectedFigureIds]);

  const activeFigurePatterns = useMemo(
    () => savedFigures.filter((figure) => selectedFigureIdSet.has(figure.id)).map((figure) => figure.pattern),
    [savedFigures, selectedFigureIdSet],
  );

  const activeFigureCellSet = useMemo(() => {
    const cellSet = new Set<string>();

    for (const pattern of activeFigurePatterns) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (pattern[row]?.[col]) {
            cellSet.add(`${row}-${col}`);
          }
        }
      }
    }

    return cellSet;
  }, [activeFigurePatterns]);

  const matchingCards = useMemo(() => {
    if (figureMode === "full") {
      return cards.filter((card) => cardIsFull(card));
    }

    if (activeFigurePatterns.length === 0) {
      return [] as Card[];
    }

    return cards.filter((card) => cardMatchesAnyFigure(card, activeFigurePatterns));
  }, [cards, figureMode, activeFigurePatterns]);

  const matchingCardIds = useMemo(() => new Set(matchingCards.map((card) => card.id)), [matchingCards]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setError(null);

    const [meRes, cardsRes, markedRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/cards"),
      fetch("/api/cards/mark-number"),
    ]);

    if (!meRes.ok) {
      setError("Debes iniciar sesión.");
      return;
    }

    const mePayload = (await meRes.json()) as MeResponse;
    setMe(mePayload);

    if (cardsRes.ok) {
      const cardsPayload = (await cardsRes.json()) as { cards: Card[] };
      setCards(cardsPayload.cards);
    }

    if (markedRes.ok) {
      const markedPayload = (await markedRes.json()) as { markedNumbers: number[] };
      const sorted = [...(markedPayload.markedNumbers ?? [])].sort((a, b) => a - b);
      setMarkedCalls(sorted);
      setSelectedMarkedCalls((previous) => previous.filter((value) => sorted.includes(value)));
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function deleteCard(cardId: string) {
    const confirmed = window.confirm("¿Seguro que deseas eliminar esta carta?");
    if (!confirmed) {
      return;
    }

    setDeletingCardId(cardId);
    setError(null);

    try {
      const response = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "No se pudo eliminar la carta.");
        return;
      }

      setCards((previous) => previous.filter((card) => card.id !== cardId));
      setMe((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          cardsCount: Math.max(0, previous.cardsCount - 1),
        };
      });
    } finally {
      setDeletingCardId(null);
    }
  }

  async function deleteAllCards() {
    const confirmed = window.confirm("¿Seguro que deseas eliminar todos los cartones?");
    if (!confirmed) {
      return;
    }

    setDeletingAll(true);
    setError(null);

    try {
      const response = await fetch("/api/cards", { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "No se pudieron eliminar los cartones.");
        return;
      }

      setCards([]);
      setMe((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          cardsCount: 0,
        };
      });
    } finally {
      setDeletingAll(false);
    }
  }

  async function markNumberAllCards(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBulkMessage(null);

    const parsed = Number(numberInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 75) {
      setBulkMessage("Ingresa un número válido entre 1 y 75.");
      return;
    }

    setMarkingAll(true);

    try {
      const response = await fetch("/api/cards/mark-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: parsed }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setBulkMessage(payload.error ?? "No se pudo marcar el número en los cartones.");
        return;
      }

      const updatedCount = Number(payload.updatedCount ?? 0);
      if (updatedCount === 0) {
        setBulkMessage(`El número ${parsed} no se agregó en ningún cartón.`);
      } else {
        setBulkMessage(`Número ${parsed} agregado en ${updatedCount} cartón(es).`);
      }

      setNumberInput("");
      await loadData();
    } finally {
      setMarkingAll(false);
    }
  }

  function toggleMarkedNumberSelection(number: number) {
    setSelectedMarkedCalls((previous) =>
      previous.includes(number)
        ? previous.filter((value) => value !== number)
        : [...previous, number].sort((a, b) => a - b),
    );
  }

  async function deleteMarkedNumbers(numbers: number[]) {
    if (numbers.length === 0) {
      setMarkedCallsMessage("Selecciona al menos un número.");
      return;
    }

    const label = numbers.length === 1 ? `el número ${numbers[0]}` : `${numbers.length} números seleccionados`;
    const confirmed = window.confirm(`¿Seguro que deseas borrar ${label}?`);
    if (!confirmed) {
      return;
    }

    setDeletingMarkedCalls(true);
    setMarkedCallsMessage(null);

    try {
      const response = await fetch("/api/cards/mark-number", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMarkedCallsMessage(payload.error ?? "No se pudieron borrar los números marcados.");
        return;
      }

      const remaining = [...(payload.markedNumbers ?? [])].sort((a: number, b: number) => a - b);
      setMarkedCalls(remaining);
      setSelectedMarkedCalls((previous) => previous.filter((value) => remaining.includes(value)));
      setMarkedCallsMessage(`Se borraron ${numbers.length} número(s) marcados.`);
      await loadData();
    } finally {
      setDeletingMarkedCalls(false);
    }
  }

  function toggleFigureCell(rowIndex: number, colIndex: number) {
    setFigurePattern((previous) => {
      const next = previous.map((row) => [...row]);
      next[rowIndex][colIndex] = !next[rowIndex][colIndex];
      return next;
    });
  }

  function clearFigurePattern() {
    setFigurePattern(createEmptyFigurePattern());
  }

  function addCurrentFigure() {
    if (currentFigureCells === 0) {
      return;
    }

    const nextPattern = clonePattern(figurePattern);
    const key = patternKey(nextPattern);

    const duplicate = savedFigures.some((figure) => patternKey(figure.pattern) === key);
    if (duplicate) {
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name = `Figura ${savedFigures.length + 1}`;

    setSavedFigures((previous) => [...previous, { id, name, pattern: nextPattern }]);
    setSelectedFigureIds((previous) => [...previous, id]);
    setFigurePattern(createEmptyFigurePattern());
  }

  function toggleFigureSelection(figureId: string) {
    setSelectedFigureIds((previous) =>
      previous.includes(figureId) ? previous.filter((id) => id !== figureId) : [...previous, figureId],
    );
  }

  function removeFigure(figureId: string) {
    setSavedFigures((previous) => previous.filter((figure) => figure.id !== figureId));
    setSelectedFigureIds((previous) => previous.filter((id) => id !== figureId));
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sky-50 p-6">
        <div className="rounded-xl bg-sky-100 p-6 text-zinc-800">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sky-50 p-6">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-900 p-6 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-300">Panel</p>
            <h1 className="mt-2 text-2xl font-bold">Bienvenido {me?.user.username ?? me?.user.email}</h1>
            <p className="mt-1 text-sm text-zinc-300">Cartas registradas: {me?.cardsCount ?? 0}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/cards/new" className="rounded-lg bg-sky-300 px-4 py-2 font-semibold text-zinc-900">
              Nueva carta
            </Link>
            {me?.user.role === "ADMIN" ? (
              <Link href="/register" className="rounded-lg border border-sky-300 bg-sky-100 px-4 py-2 font-semibold text-zinc-900">
                Registrar usuario
              </Link>
            ) : null}
            <button onClick={logout} className="rounded-lg border border-zinc-500 px-4 py-2">
              Salir
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <h3 className="text-base font-bold text-zinc-900">Marcar número en todos los cartones</h3>
            <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={markNumberAllCards}>
              <input
                type="number"
                min={1}
                max={75}
                value={numberInput}
                onChange={(event) => setNumberInput(event.target.value)}
                className="w-40 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none ring-sky-300 transition focus:ring"
                placeholder="Ej: 42"
              />
              <button
                type="submit"
                disabled={markingAll || deletingAll}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingAll ? "Marcando..." : "Marcar en todos"}
              </button>
            </form>
            {bulkMessage ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-800">{bulkMessage}</p> : null}
          </div>

          <div className="mb-5 rounded-xl border border-sky-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-zinc-900">Números marcados</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void deleteMarkedNumbers(selectedMarkedCalls)}
                  disabled={deletingMarkedCalls || selectedMarkedCalls.length === 0}
                  className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingMarkedCalls ? "Borrando..." : `Borrar seleccionados (${selectedMarkedCalls.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMarkedCalls(markedCalls)}
                  disabled={deletingMarkedCalls || markedCalls.length === 0}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMarkedCalls([])}
                  disabled={deletingMarkedCalls || selectedMarkedCalls.length === 0}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {markedCalls.length === 0 ? (
              <p className="mt-3 text-sm font-medium text-zinc-600">Aún no hay números marcados globalmente.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {markedCalls.map((value) => {
                  const selected = selectedMarkedCalls.includes(value);
                  return (
                    <label
                      key={value}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold",
                        selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-sky-300 bg-sky-50 text-zinc-900",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMarkedNumberSelection(value)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      <span>{value}</span>
                      <button
                        type="button"
                        onClick={() => void deleteMarkedNumbers([value])}
                        disabled={deletingMarkedCalls}
                        className={[
                          "rounded-md px-2 py-0.5 text-[11px] font-bold",
                          selected ? "bg-white text-zinc-900" : "bg-zinc-900 text-white",
                        ].join(" ")}
                      >
                        Borrar
                      </button>
                    </label>
                  );
                })}
              </div>
            )}

            {markedCallsMessage ? (
              <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-zinc-800">{markedCallsMessage}</p>
            ) : null}
          </div>

          <div className="mb-5 rounded-xl border border-sky-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-zinc-900">Figura de bingo</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFigureMode("custom")}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    figureMode === "custom" ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-800",
                  ].join(" ")}
                >
                  Figura personalizada
                </button>
                <button
                  type="button"
                  onClick={() => setFigureMode("full")}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    figureMode === "full" ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-800",
                  ].join(" ")}
                >
                  Cartón lleno
                </button>
              </div>
            </div>

            {figureMode === "custom" ? (
              <>
                <p className="mt-2 text-sm font-medium text-zinc-700">Dibuja una figura y agrégala. Puedes guardar y combinar varias figuras.</p>
                <div className="mt-3 inline-grid grid-cols-5 gap-1 rounded-lg border border-sky-200 bg-sky-50 p-2">
                  {figurePattern.flatMap((row, rowIndex) =>
                    row.map((isSelected, colIndex) => {
                      const isCenter = rowIndex === 2 && colIndex === 2;
                      return (
                        <button
                          key={`figure-${rowIndex}-${colIndex}`}
                          type="button"
                          onClick={() => toggleFigureCell(rowIndex, colIndex)}
                          className={[
                            "flex h-8 w-8 items-center justify-center rounded text-xs font-bold transition",
                            isCenter
                              ? "border border-zinc-900 bg-zinc-900 text-white"
                              : isSelected
                                ? "bg-sky-300 text-zinc-900"
                                : "border border-zinc-300 bg-white text-zinc-700",
                          ].join(" ")}
                        >
                          {isCenter ? "F" : isSelected ? "X" : "-"}
                        </button>
                      );
                    }),
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={addCurrentFigure}
                    disabled={currentFigureCells === 0}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Agregar figura
                  </button>
                  <button
                    type="button"
                    onClick={clearFigurePattern}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800"
                  >
                    Limpiar dibujo
                  </button>
                  <span className="text-xs font-semibold text-zinc-700">Celdas en dibujo: {currentFigureCells}</span>
                </div>

                <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-700">Figuras guardadas</p>
                  {savedFigures.length === 0 ? (
                    <p className="mt-2 text-sm font-medium text-zinc-600">Aún no hay figuras guardadas.</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {savedFigures.map((figure) => {
                        const selected = selectedFigureIdSet.has(figure.id);
                        return (
                          <li key={figure.id} className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-2.5 py-1.5">
                            <div className="inline-grid grid-cols-5 gap-[2px] rounded border border-sky-200 bg-white p-1" aria-hidden="true">
                              {figure.pattern.flatMap((row, rowIndex) =>
                                row.map((isFilled, colIndex) => {
                                  const isCenter = rowIndex === 2 && colIndex === 2;
                                  const active = isCenter || isFilled;
                                  return (
                                    <span
                                      key={`thumb-${figure.id}-${rowIndex}-${colIndex}`}
                                      className={[
                                        "h-2 w-2 rounded-[2px] border",
                                        active ? "border-sky-500 bg-sky-400" : "border-zinc-300 bg-white",
                                      ].join(" ")}
                                    />
                                  );
                                }),
                              )}
                            </div>
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-zinc-900">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleFigureSelection(figure.id)}
                                className="h-3.5 w-3.5 rounded border-zinc-300"
                              />
                              <span>{figure.name} ({countPatternCells(figure.pattern)})</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeFigure(figure.id)}
                              className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white"
                            >
                              X
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm font-medium text-zinc-700">Se validan todas las celdas del cartón (incluyendo centro libre).</p>
            )}

            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
              {figureMode === "custom" && selectedFigureIds.length === 0 ? (
                <p className="text-sm font-medium text-zinc-700">Selecciona al menos una figura guardada para evaluar.</p>
              ) : matchingCards.length === 0 ? (
                <p className="text-sm font-medium text-zinc-700">Aún no hay cartones que cumplan la condición.</p>
              ) : (
                <div>
                  <p className="text-sm font-bold text-zinc-900">
                    {figureMode === "full" ? "Cartón lleno" : "Figura completa"}: {matchingCards.length} cartón(es)
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {matchingCards.map((card) => (
                      <li key={`winner-${card.id}`} className="rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                        {card.name ?? card.id.slice(0, 8)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-zinc-900">Tus cartas</h2>
            {cards.length > 0 ? (
              <button
                onClick={deleteAllCards}
                disabled={deletingAll || deletingCardId !== null}
                className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? "Eliminando todos..." : "Eliminar todos"}
              </button>
            ) : null}
          </div>
          {cards.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Aún no tienes cartas. Crea la primera.</p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <li
                  key={card.id}
                  className={[
                    "flex flex-col items-center rounded-2xl border bg-gradient-to-b from-white to-sky-50 p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    matchingCardIds.has(card.id) ? "border-zinc-900 ring-2 ring-zinc-900/20" : "border-sky-200",
                  ].join(" ")}
                >
                  <p className="text-base font-black text-zinc-900">{card.name ?? "Sin nombre"}</p>
                  <p className="mt-1 text-xs font-medium text-zinc-500">ID: {card.id.slice(0, 10)}...</p>
                  {matchingCardIds.has(card.id) ? (
                    <span className="mt-2 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white">
                      {figureMode === "full" ? "Cartón lleno" : "Figura completa"}
                    </span>
                  ) : null}
                  <div className="mt-3 inline-flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-700">Estado</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClassName(card.status)}`}>
                      {getStatusLabel(card.status)}
                    </span>
                  </div>
                  <div className="mt-4 flex w-full flex-col items-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Miniatura</p>
                    {card.correctedGrid ? (
                      <div className="mt-2 inline-grid grid-cols-5 gap-1 rounded-lg border border-sky-200 bg-white p-1.5">
                        {card.correctedGrid.flatMap((row, rowIndex) =>
                          row.map((value, colIndex) => {
                            const isCenterFree = rowIndex === 2 && colIndex === 2;
                            const figureFilterActive = figureMode === "custom" && selectedFigureIds.length > 0;
                            const isFigureCell = figureFilterActive ? activeFigureCellSet.has(`${rowIndex}-${colIndex}`) : true;
                            const isMarked = isCardCellMarked(card, rowIndex, colIndex);
                            const isHighlighted = isFigureCell && isMarked;
                            return (
                              <div
                                key={`${card.id}-${rowIndex}-${colIndex}`}
                                className={[
                                  "relative flex h-6 w-6 items-center justify-center rounded text-[10px]",
                                  isCenterFree ? "border border-zinc-300 bg-zinc-100 text-zinc-600" : "",
                                  isHighlighted ? "border-2 border-sky-500 bg-sky-300 font-black text-zinc-950 shadow" : "",
                                  figureFilterActive && !isFigureCell ? "border border-zinc-200 bg-zinc-50 text-zinc-400" : "",
                                  !isHighlighted && (!figureFilterActive || isFigureCell) && !isCenterFree
                                    ? "border border-zinc-300 bg-white font-semibold text-zinc-700"
                                    : "",
                                ].join(" ")}
                              >
                                {isHighlighted && !isCenterFree ? (
                                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-zinc-900" aria-hidden="true" />
                                ) : null}
                                {isCenterFree ? "F" : value ?? "-"}
                              </div>
                            );
                          }),
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-zinc-500">Sin grilla procesada.</p>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-700">Marcados: {card.markedNumbers.length}</p>
                  <div className="mt-4 flex w-full items-center justify-center gap-2">
                    <Link
                      href={`/cards/${card.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Abrir carta
                    </Link>
                    <button
                      onClick={() => deleteCard(card.id)}
                      disabled={deletingCardId === card.id || deletingAll}
                      className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                    >
                      {deletingCardId === card.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
