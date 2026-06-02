"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Mode = "single" | "x4";
type CropRect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function NewCardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [cropRect, setCropRect] = React.useState<CropRect | null>(null);
  const [cropRects, setCropRects] = React.useState<CropRect[]>([]);
  const [dragStart, setDragStart] = React.useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = React.useState<Point | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [mode, setMode] = React.useState<Mode>("single");
  const [cardName, setCardName] = React.useState("");

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
  }

  function toLocalPoint(clientX: number, clientY: number): Point | null {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    return {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!previewUrl) return;
    event.preventDefault();
    const local = toLocalPoint(event.clientX, event.clientY);
    if (!local) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    setDragStart(local);
    setDragCurrent(local);
    setError(null);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    event.preventDefault();
    const local = toLocalPoint(event.clientX, event.clientY);
    if (local) setDragCurrent(local);
  }

  function finalize(rectWidth: number, rectHeight: number, minX: number, minY: number, totalWidth: number, totalHeight: number) {
    if (rectWidth < 20 || rectHeight < 20) {
      setError("Selecciona un área más grande para la grilla.");
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const normalized: CropRect = {
      x: minX / totalWidth,
      y: minY / totalHeight,
      width: rectWidth / totalWidth,
      height: rectHeight / totalHeight,
    };

    if (mode === "x4") {
      setCropRects((prev) => (prev.length >= 4 ? prev : [...prev, normalized]));
      setInfo(
        cropRects.length < 3
          ? `Rectángulo ${cropRects.length + 1}/4 guardado. Selecciona el siguiente cartón.`
          : "Listo: se guardaron 4 rectángulos.",
      );
    } else {
      setCropRect(normalized);
      setInfo("Área de celdas seleccionada.");
    }

    setError(null);
    setDragStart(null);
    setDragCurrent(null);
  }

  function finalizeFromPointer() {
    if (!dragStart || !dragCurrent) return;
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
    finalize(width, height, minX, minY, rect.width, rect.height);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    finalizeFromPointer();
  }

  function onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    finalizeFromPointer();
  }

  const draftRect: CropRect | null = React.useMemo(() => {
    if (!dragStart || !dragCurrent) return null;
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);
    return {
      x: x / rect.width,
      y: y / rect.height,
      width: w / rect.width,
      height: h / rect.height,
    };
  }, [dragStart, dragCurrent]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!file) {
      setError("Debes seleccionar una imagen.");
      return;
    }
    if (mode === "x4" && cropRects.length !== 4) {
      setError("Debes seleccionar 4 rectángulos, uno por cada cartón.");
      return;
    }
    if (mode === "single" && !cropRect) {
      setError("Primero selecciona el espacio de celdas en la imagen.");
      return;
    }

    startTransition(async () => {
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
          const message = uploadPayload.error ?? "No se pudo subir la imagen.";
          setError(message);
          toast({ title: "Error al subir", description: message, variant: "error" });
          return;
        }

        const cardId = uploadPayload.card.id as string;

        const generateResponse = await fetch(`/api/cards/${cardId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "x4" ? { mode, cropRects } : { mode, cropRect }),
        });
        const generatePayload = await generateResponse.json();
        if (!generateResponse.ok) {
          const message = generatePayload.error ?? "No se pudo generar la carta.";
          setError(message);
          toast({ title: "Error al generar", description: message, variant: "error" });
          return;
        }

        const extractedCount = Number(generatePayload.extractedCount ?? 0);
        const message =
          extractedCount > 0
            ? mode === "x4"
              ? `OCR detectó ${extractedCount} números en los 4 cartones.`
              : `OCR detectó ${extractedCount} números.`
            : "OCR no detectó números suficientes. Puedes corregir la grilla manualmente.";

        setInfo(message);
        toast({
          title: "Carta creada",
          description: message,
          variant: extractedCount > 0 ? "success" : "info",
        });

        if (mode === "x4") {
          router.push("/dashboard");
        } else {
          router.push(`/cards/${cardId}`);
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : "Error inesperado";
        setError(m);
        toast({ title: "Error", description: m, variant: "error" });
      }
    });
  }

  const validSelection = mode === "single" ? !!cropRect : cropRects.length === 4;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
            Nueva carta
          </p>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-fg)]">Registrar cartón</h1>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeftIcon className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sube una imagen</CardTitle>
          <CardDescription>
            Formatos: JPG, JPEG o PNG. Dibuja un rectángulo sobre la grilla de celdas y la IA extraerá los números.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div>
              <Label className="mb-1.5">Formato</Label>
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
                <SegmentButton
                  active={mode === "single"}
                  onClick={() => {
                    setMode("single");
                    setCropRects([]);
                    setCropRect(null);
                    setInfo("Modo 1 cartón seleccionado.");
                  }}
                >
                  1 cartón
                </SegmentButton>
                <SegmentButton
                  active={mode === "x4"}
                  onClick={() => {
                    setMode("x4");
                    setCropRects([]);
                    setCropRect(null);
                    setInfo("Modo x4. Dibuja 4 rectángulos.");
                  }}
                >
                  4 cartones
                </SegmentButton>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-name">Nombre del cartón</Label>
              <Input
                id="card-name"
                type="text"
                value={cardName}
                onChange={(event) => setCardName(event.target.value)}
                placeholder={mode === "x4" ? "CartonSemana (se guarda como /1..4)" : "Cartón principal"}
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-image">Imagen</Label>
              <input
                id="card-image"
                type="file"
                accept="image/jpg,image/jpeg,image/png"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] file:mr-3 file:cursor-pointer file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-fg)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--color-fg-inverse)] hover:file:opacity-90"
              />
            </div>

            {previewUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-fg-muted)]">
                  {mode === "x4"
                    ? `Dibuja 4 rectángulos (uno por cartón). ${cropRects.length}/4 seleccionados.`
                    : "Dibuja un rectángulo sobre la grilla de celdas."}
                </p>
                <div
                  ref={containerRef}
                  className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2"
                >
                  <div className="relative inline-block w-full">
                    <img
                      src={previewUrl}
                      alt="Vista previa"
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      className="block max-h-[420px] w-auto max-w-full mx-auto"
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
                      <CropOverlay rect={cropRect} index={0} variant="confirmed" />
                    ) : null}
                    {mode === "x4"
                      ? cropRects.map((rect, index) => (
                          <CropOverlay key={`${index}-${rect.x}`} rect={rect} index={index} variant="confirmed" />
                        ))
                      : null}
                    {draftRect ? <CropOverlay rect={draftRect} index={-1} variant="draft" /> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (mode === "x4") {
                        setCropRects([]);
                        setInfo("Selecciona nuevamente los 4 rectángulos.");
                      } else {
                        setCropRect(null);
                        setInfo("Selecciona nuevamente el área de celdas.");
                      }
                    }}
                  >
                    Limpiar selección
                  </Button>
                  {mode === "x4" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCropRects((prev) => prev.slice(0, -1));
                        setInfo("Se eliminó el último rectángulo.");
                      }}
                      disabled={cropRects.length === 0}
                    >
                      Deshacer último
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-fg)] animate-fade-in"
              >
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-info)]/30 bg-[var(--color-info-bg)] px-3 py-2 text-sm text-[var(--color-info-fg)] animate-fade-in">
                {info}
              </p>
            ) : null}

            <Button
              type="submit"
              loading={isPending}
              disabled={!file || !validSelection}
              size="lg"
              fullWidth
            >
              {isPending ? "Procesando..." : "Subir y generar"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}

interface SegmentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
}

function SegmentButton({ active, className, children, ...props }: SegmentButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-semibold transition-all",
        active
          ? "bg-[var(--color-surface)] text-[var(--color-fg)] shadow-sm"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function CropOverlay({
  rect,
  index,
  variant,
}: {
  rect: CropRect;
  index: number;
  variant: "draft" | "confirmed";
}) {
  const isDraft = variant === "draft";
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-sm transition-colors",
        isDraft
          ? "border-2 border-dashed border-[var(--color-brand-400)] bg-[var(--color-brand-500)]/15 animate-fade-in"
          : "border-2 border-[var(--color-success)] bg-[var(--color-success)]/15",
      )}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      }}
    >
      {index >= 0 ? (
        <span className="absolute left-1 top-1 rounded bg-[var(--color-fg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-fg-inverse)]">
          {index + 1}
        </span>
      ) : null}
    </div>
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
