"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setError(null);

    const [meRes, cardsRes] = await Promise.all([fetch("/api/me"), fetch("/api/cards")]);

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
                  className="flex flex-col items-center rounded-2xl border border-sky-200 bg-gradient-to-b from-white to-sky-50 p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-base font-black text-zinc-900">{card.name ?? "Sin nombre"}</p>
                  <p className="mt-1 text-xs font-medium text-zinc-500">ID: {card.id.slice(0, 10)}...</p>
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
                            const isMarked = value !== null && card.markedNumbers.includes(value);
                            return (
                              <div
                                key={`${card.id}-${rowIndex}-${colIndex}`}
                                className={[
                                  "flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold",
                                  isCenterFree ? "border border-zinc-300 bg-zinc-100 text-zinc-600" : "",
                                  isMarked ? "bg-zinc-900 text-white" : "",
                                  !isMarked && !isCenterFree ? "border border-zinc-300 bg-white text-zinc-700" : "",
                                ].join(" ")}
                              >
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
