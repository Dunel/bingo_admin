"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { swrFetcher } from "@/lib/fetcher";

export type CardStatus = "UPLOADED" | "PROCESSED" | "ERROR";
export type CardSourceMime = "IMAGE_JPG" | "IMAGE_JPEG" | "IMAGE_PNG";

export interface Card {
  id: string;
  name: string | null;
  status: CardStatus;
  sourceMimeType: CardSourceMime;
  correctedGrid: (number | null)[][] | null;
  markedNumbers: number[];
  createdAt: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    username: string | null;
    role: "ADMIN" | "USER";
  };
  cardsCount: number;
}

export interface MarkedCallsResponse {
  markedNumbers: number[];
}

const meKey = "/api/me";
const cardsKey = "/api/cards";
const markedKey = "/api/cards/mark-number";

export function useDashboardData() {
  const meSwr = useSWR<MeResponse>(meKey, swrFetcher, { revalidateOnFocus: false });
  const cardsSwr = useSWR<{ cards: Card[] }>(cardsKey, swrFetcher, {
    revalidateOnFocus: false,
  });
  const markedSwr = useSWR<MarkedCallsResponse>(markedKey, swrFetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });

  const isLoading = meSwr.isLoading || cardsSwr.isLoading;
  const isValidating = meSwr.isValidating || cardsSwr.isValidating;

  const markNumber = useCallback(
    async (number: number) => {
      const res = await fetch("/api/cards/mark-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo marcar el número.");
      }
      await Promise.all([cardsSwr.mutate(), markedSwr.mutate()]);
      return payload as { updatedCount: number; markedNumbers: number[] };
    },
    [cardsSwr, markedSwr],
  );

  const deleteMarkedNumbers = useCallback(
    async (numbers: number[]) => {
      const res = await fetch("/api/cards/mark-number", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudieron borrar los números.");
      }
      await Promise.all([cardsSwr.mutate(), markedSwr.mutate()]);
      return payload as { markedNumbers: number[] };
    },
    [cardsSwr, markedSwr],
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo eliminar la carta.");
      }
      await cardsSwr.mutate();
      return payload;
    },
    [cardsSwr],
  );

  const deleteAllCards = useCallback(async () => {
    const res = await fetch("/api/cards", { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error ?? "No se pudieron eliminar los cartones.");
    }
    await Promise.all([cardsSwr.mutate(), meSwr.mutate()]);
    return payload as { deletedCount: number };
  }, [cardsSwr, meSwr]);

  const refreshAll = useCallback(async () => {
    await Promise.all([meSwr.mutate(), cardsSwr.mutate(), markedSwr.mutate()]);
  }, [meSwr, cardsSwr, markedSwr]);

  return {
    me: meSwr.data ?? null,
    cards: cardsSwr.data?.cards ?? [],
    markedCalls: (markedSwr.data?.markedNumbers ?? []).slice().sort((a, b) => a - b),
    isLoading,
    isValidating,
    error: meSwr.error ?? cardsSwr.error ?? null,
    actions: {
      markNumber,
      deleteMarkedNumbers,
      deleteCard,
      deleteAllCards,
      refreshAll,
    },
  };
}
