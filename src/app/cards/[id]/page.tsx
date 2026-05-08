"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export default function CardDetailPage({ params }: Props) {
  const [cardId, setCardId] = useState<string>("");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [cardName, setCardName] = useState<string | null>(null);
  const [grid, setGrid] = useState<(number | null)[][]>([]);
  const [editableGrid, setEditableGrid] = useState<(number | null)[][]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);
  const [status, setStatus] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [savingGrid, setSavingGrid] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void params.then((value) => {
      setCardId(value.id);
    });
  }, [params]);

  useEffect(() => {
    if (!cardId) return;
    void loadCard(cardId);
  }, [cardId]);

  async function loadCard(id: string) {
    const response = await fetch(`/api/cards/${id}`);
    const payload = (await response.json()) as CardPayload;

    if (!response.ok) {
      setMessage(payload?.card ? null : "No se pudo cargar la carta.");
      return;
    }

    setStatus(payload.card.status);
    setCardName(payload.card.name);
    setGrid(payload.card.correctedGrid ?? []);
    setEditableGrid(payload.card.correctedGrid ?? []);
    setMarkedNumbers(payload.card.markedNumbers ?? []);
    setSourceImageUrl(payload.card.sourceImageUrl ?? "");
  }

  const markedSet = useMemo(() => new Set(markedNumbers), [markedNumbers]);

  function onGridCellChange(rowIndex: number, colIndex: number, rawValue: string) {
    setEditableGrid((previous) => {
      const next = previous.map((row) => [...row]);

      if (!next[rowIndex] || next[rowIndex][colIndex] === undefined) {
        return previous;
      }

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
    if (!cardId) {
      return;
    }

    setSavingGrid(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cards/${cardId}/grid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: editableGrid }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo guardar la grilla.");
        return;
      }

      setGrid(payload.card.correctedGrid ?? editableGrid);
      setEditing(false);
      setMessage("Grilla actualizada correctamente.");
    } finally {
      setSavingGrid(false);
    }
  }

  async function markNumber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = Number(numberInput);
    if (!Number.isInteger(parsed)) {
      setMessage("Ingresa un número válido.");
      return;
    }

    const response = await fetch(`/api/cards/${cardId}/mark-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: parsed }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo marcar el número.");
      return;
    }

    setMarkedNumbers(payload.markedNumbers ?? []);

    if (!payload.found) {
      setMessage("Número no encontrado en esta carta.");
      return;
    }

    if (payload.alreadyMarked) {
      setMessage("Ese número ya estaba marcado.");
      return;
    }

    setMessage("Número marcado correctamente.");
    setNumberInput("");
  }

  return (
    <main className="min-h-screen bg-sky-50 p-6">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-700">Carta</p>
            <h1 className="text-2xl font-black text-zinc-900">Detalle y marcado</h1>
            <p className="text-sm font-medium text-zinc-800">Nombre: {cardName ?? "Sin nombre"}</p>
            <p className="text-sm font-medium text-zinc-700">Estado: {status || "Cargando..."}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-sky-200"
          >
            Volver al panel
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-zinc-900">Grilla de bingo</h2>
              <button
                onClick={() => {
                  if (editing) {
                    setEditableGrid(grid);
                    setEditing(false);
                    return;
                  }
                  setEditableGrid(grid);
                  setEditing(true);
                }}
                className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-sky-200"
              >
                {editing ? "Cancelar edición" : "Editar números"}
              </button>
            </div>
            {grid.length === 0 ? (
              <p className="text-sm font-medium text-zinc-700">Aún no hay grilla disponible para esta carta.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {(editing ? editableGrid : grid).flatMap((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const isMarked = value !== null && markedSet.has(value);
                    const isCenterFree = rowIndex === 2 && colIndex === 2;
                    const isEmpty = value === null && !isCenterFree;

                    return (
                      <div key={`${rowIndex}-${colIndex}`} className="aspect-square">
                        {editing && !(rowIndex === 2 && colIndex === 2) ? (
                          <input
                            type="number"
                            min={1}
                            max={75}
                            value={value ?? ""}
                            onChange={(event) => onGridCellChange(rowIndex, colIndex, event.target.value)}
                            className="h-full w-full rounded-lg border border-zinc-300 px-2 text-center text-sm font-semibold"
                          />
                        ) : (
                          <div
                            className={[
                              "flex h-full items-center justify-center rounded-lg border text-lg font-bold",
                              isCenterFree ? "border-zinc-300 bg-zinc-100 text-zinc-500" : "",
                              isEmpty ? "border-zinc-300 bg-sky-50 text-zinc-700" : "",
                              isMarked ? "border-sky-400 bg-sky-200 text-zinc-900" : "",
                              !isMarked && !isCenterFree && !isEmpty ? "border-zinc-300 bg-white text-zinc-800" : "",
                            ].join(" ")}
                          >
                            {isCenterFree ? "FREE" : value ?? "-"}
                          </div>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            )}

            {editing ? (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={saveGrid}
                  disabled={savingGrid}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingGrid ? "Guardando..." : "Guardar grilla"}
                </button>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-bold text-zinc-900">Imagen cargada</h2>
            {sourceImageUrl ? (
              <img src={sourceImageUrl} alt="Carta de bingo" className="mt-3 max-h-56 w-full rounded-xl border border-zinc-200 object-contain" />
            ) : (
              <p className="mt-3 text-sm font-medium text-zinc-700">No hay imagen disponible.</p>
            )}

            <h2 className="text-lg font-bold text-zinc-900">Marcar número</h2>
            <form className="mt-4 space-y-3" onSubmit={markNumber}>
              <input
                type="number"
                min={1}
                max={75}
                value={numberInput}
                onChange={(event) => setNumberInput(event.target.value)}
                className="w-full rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 font-medium text-zinc-900 outline-none ring-sky-300 transition focus:ring"
                placeholder="Ej: 42"
              />
              <button className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">Marcar</button>
            </form>

            {message ? <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{message}</p> : null}

            <div className="mt-5">
              <h3 className="text-sm font-bold text-zinc-900">Números marcados</h3>
              <p className="mt-2 text-sm font-medium text-zinc-700">{markedNumbers.length > 0 ? markedNumbers.join(", ") : "Sin números"}</p>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
