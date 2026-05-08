"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function NewCardPage() {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [cropRects, setCropRects] = useState<CropRect[]>([]);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "x4">("single");
  const [cardName, setCardName] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setError(null);
    setInfo(null);
    setCropRect(null);
    setCropRects([]);
    setDragStart(null);
    setDragCurrent(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (nextFile) {
      setPreviewUrl(URL.createObjectURL(nextFile));
      return;
    }

    setPreviewUrl(null);
  }

  function toLocalPoint(clientX: number, clientY: number): Point | null {
    const overlay = overlayRef.current;
    if (!overlay) {
      return null;
    }

    const rect = overlay.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);

    return { x, y };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!previewUrl) {
      return;
    }

    event.preventDefault();

    const local = toLocalPoint(event.clientX, event.clientY);
    if (!local) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Fallback when pointer capture is not available.
    }
    setDragStart(local);
    setDragCurrent(local);
    setError(null);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart) {
      return;
    }

    event.preventDefault();

    const local = toLocalPoint(event.clientX, event.clientY);
    if (!local) {
      return;
    }

    setDragCurrent(local);
  }

  function finalizeSelection(rectWidth: number, rectHeight: number, minX: number, minY: number, totalWidth: number, totalHeight: number) {
    if (rectWidth < 20 || rectHeight < 20) {
      setError("Selecciona un área más grande para la grilla.");
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const normalizedRect = {
      x: minX / totalWidth,
      y: minY / totalHeight,
      width: rectWidth / totalWidth,
      height: rectHeight / totalHeight,
    };

    if (mode === "x4") {
      const nextCount = Math.min(cropRects.length + 1, 4);
      setCropRects((prev) => (prev.length >= 4 ? prev : [...prev, normalizedRect]));
      setInfo(
        nextCount < 4
          ? `Rectángulo ${nextCount}/4 guardado. Selecciona el siguiente cartón.`
          : "Listo: se guardaron 4 rectángulos.",
      );
    } else {
      setCropRect(normalizedRect);
      setInfo("Área de celdas seleccionada.");
    }

    setError(null);
    setDragStart(null);
    setDragCurrent(null);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart || !dragCurrent) {
      return;
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Fallback when pointer capture is not available.
    }

    const overlay = overlayRef.current;
    if (!overlay) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const rect = overlay.getBoundingClientRect();
    const minX = Math.min(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);

    finalizeSelection(width, height, minX, minY, rect.width, rect.height);
  }

  function onPointerCancel() {
    if (!dragStart || !dragCurrent) {
      return;
    }

    const overlay = overlayRef.current;
    if (!overlay) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const rect = overlay.getBoundingClientRect();
    const minX = Math.min(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);

    finalizeSelection(width, height, minX, minY, rect.width, rect.height);
  }

  const draftRect =
    dragStart && dragCurrent
      ? {
          x: Math.min(dragStart.x, dragCurrent.x),
          y: Math.min(dragStart.y, dragCurrent.y),
          width: Math.abs(dragCurrent.x - dragStart.x),
          height: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!file) {
      setError("Debes seleccionar una imagen.");
      return;
    }

    if (mode === "x4") {
      if (cropRects.length !== 4) {
        setError("Debes seleccionar 4 rectángulos, uno por cada cartón.");
        return;
      }
    } else {
      if (!cropRect) {
        setError("Primero selecciona el espacio de celdas en la imagen.");
        return;
      }
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", cardName);

      const uploadResponse = await fetch("/api/cards", {
        method: "POST",
        body: formData,
      });

      const uploadPayload = await uploadResponse.json();

      if (!uploadResponse.ok) {
        setError(uploadPayload.error ?? "No se pudo subir la imagen.");
        return;
      }

      const cardId = uploadPayload.card.id as string;

      const generateResponse = await fetch(`/api/cards/${cardId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "x4"
            ? { mode, cropRects }
            : { mode, cropRect },
        ),
      });

      const generatePayload = await generateResponse.json();

      if (!generateResponse.ok) {
        setError(generatePayload.error ?? "No se pudo generar la carta.");
        return;
      }

      const extractedCount = Number(generatePayload.extractedCount ?? 0);
      if (extractedCount > 0) {
        setInfo(
          mode === "x4"
            ? `OCR detectó ${extractedCount} números en los 4 cartones.`
            : `OCR detectó ${extractedCount} números.`,
        );
      } else {
        setInfo("OCR no detectó números suficientes. Puedes corregir la grilla manualmente.");
      }

      if (mode === "x4") {
        router.push("/dashboard");
      } else {
        router.push(`/cards/${cardId}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-sky-50 p-6">
      <section className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-8 shadow">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black text-zinc-900">Registrar nueva carta</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-sky-200"
          >
            Volver
          </Link>
        </div>

        <p className="mt-2 text-sm font-medium text-zinc-700">Sube una imagen jpg, jpeg o png para generar la carta.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-sm font-semibold text-zinc-900">Formato de imagen</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("single");
                  setCropRects([]);
                  setCropRect(null);
                  setInfo("Modo 1 cartón seleccionado.");
                }}
                className={[
                  "rounded-lg px-3 py-2 text-sm",
                  mode === "single" ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700",
                ].join(" ")}
              >
                1 cartón
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("x4");
                  setCropRects([]);
                  setCropRect(null);
                  setInfo("Modo x4 seleccionado. Dibuja 4 rectángulos.");
                }}
                className={[
                  "rounded-lg px-3 py-2 text-sm",
                  mode === "x4" ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700",
                ].join(" ")}
              >
                4 cartones (x4)
              </button>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-900">Nombre del cartón</span>
            <input
              type="text"
              value={cardName}
              onChange={(event) => setCardName(event.target.value)}
              placeholder={mode === "x4" ? "Ej: CartonSemana (se guardará como CartonSemana/1..4)" : "Ej: Carton principal"}
              maxLength={80}
              className="w-full rounded-xl border border-sky-300 bg-sky-50 p-3 font-medium text-zinc-900 outline-none ring-sky-300 transition focus:ring"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-900">Imagen de carta</span>
            <input
              type="file"
              accept="image/jpg,image/jpeg,image/png"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-sky-300 bg-sky-50 p-3 font-medium text-zinc-900 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>

          {previewUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-700">
                {mode === "x4"
                  ? `Dibuja 4 rectángulos independientes (uno por cartón). ${cropRects.length}/4 seleccionados.`
                  : "Dibuja un rectángulo sobre la grilla de celdas para que OCR lea solo esa zona."}
              </p>
              <div className="overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 p-2">
                <div className="flex justify-center">
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Vista previa"
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      className="block max-h-[420px] w-auto max-w-full"
                    />

                    <div
                      ref={overlayRef}
                      className="absolute inset-0 touch-none select-none cursor-crosshair"
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerCancel}
                      onPointerLeave={onPointerCancel}
                    />

                    {mode === "single" && cropRect ? (
                      <div
                        className="pointer-events-none absolute border-2 border-sky-500 bg-sky-500/15"
                        style={{
                          left: `${cropRect.x * 100}%`,
                          top: `${cropRect.y * 100}%`,
                          width: `${cropRect.width * 100}%`,
                          height: `${cropRect.height * 100}%`,
                        }}
                      />
                    ) : null}

                    {mode === "x4"
                      ? cropRects.map((rect, index) => (
                          <div
                            key={`${rect.x}-${rect.y}-${index}`}
                            className="pointer-events-none absolute border-2 border-sky-500 bg-sky-500/10"
                            style={{
                              left: `${rect.x * 100}%`,
                              top: `${rect.y * 100}%`,
                              width: `${rect.width * 100}%`,
                              height: `${rect.height * 100}%`,
                            }}
                          >
                            <span className="absolute left-1 top-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                              {index + 1}
                            </span>
                          </div>
                        ))
                      : null}

                    {draftRect ? (
                      <div
                        className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/20"
                        style={{
                          left: `${draftRect.x}px`,
                          top: `${draftRect.y}px`,
                          width: `${draftRect.width}px`,
                          height: `${draftRect.height}px`,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mode === "x4") {
                    setCropRects([]);
                    setInfo("Selecciona nuevamente los 4 rectángulos.");
                  } else {
                    setCropRect(null);
                    setInfo("Selecciona nuevamente el área de celdas.");
                  }
                }}
                className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-sky-200"
              >
                Limpiar selección
              </button>
              {mode === "x4" ? (
                <button
                  type="button"
                  onClick={() => {
                    setCropRects((prev) => prev.slice(0, -1));
                    setInfo("Se eliminó el último rectángulo.");
                  }}
                  disabled={cropRects.length === 0}
                  className="ml-2 rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Deshacer último
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="rounded-lg bg-sky-100 px-3 py-2 text-sm text-zinc-800">{error}</p> : null}
          {info ? <p className="rounded-lg bg-sky-100 px-3 py-2 text-sm text-zinc-800">{info}</p> : null}

          <button
            disabled={loading}
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Subir y generar"}
          </button>
        </form>
      </section>
    </main>
  );
}
