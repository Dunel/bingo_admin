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
import { CameraCapture } from "@/components/camera-capture";

type Mode = "single" | "x2" | "x4" | "x6";
type CropRect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

const EXPECTED_RECTS: Record<Mode, number> = { single: 1, x2: 2, x4: 4, x6: 6 };
const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "single", label: "1 cartón" },
  { value: "x2", label: "2 cartones" },
  { value: "x4", label: "4 cartones" },
  { value: "x6", label: "6 cartones" },
];

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
  const [showCamera, setShowCamera] = React.useState(false);

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

    if (mode !== "single") {
      const expected = EXPECTED_RECTS[mode];
      const newCount = cropRects.length + 1;
      const clamped = newCount > expected ? expected : newCount;
      setCropRects((prev) => (prev.length >= expected ? prev : [...prev, normalized]));
      setInfo(
        clamped < expected
          ? `Rectángulo ${clamped}/${expected} guardado. Selecciona el siguiente cartón.`
          : `Listo: se guardaron ${expected} rectángulos.`,
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
    if (mode !== "single" && cropRects.length !== EXPECTED_RECTS[mode]) {
      setError(`Debes seleccionar ${EXPECTED_RECTS[mode]} rectángulos, uno por cada cartón.`);
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
          body: JSON.stringify(mode !== "single" ? { mode, cropRects } : { mode, cropRect }),
        });
        const generatePayload = await generateResponse.json();
        if (!generateResponse.ok) {
          const message = generatePayload.error ?? "No se pudo generar la carta.";
          setError(message);
          toast({ title: "Error al generar", description: message, variant: "error" });
          return;
        }

        const extractedCount = Number(generatePayload.extractedCount ?? 0);
        const isMulti = mode !== "single";
        const expected = EXPECTED_RECTS[mode];
        const message =
          extractedCount > 0
            ? isMulti
              ? `OCR detectó ${extractedCount} números en los ${expected} cartones.`
              : `OCR detectó ${extractedCount} números.`
            : "OCR no detectó números suficientes. Puedes corregir la grilla manualmente.";

        setInfo(message);
        toast({
          title: "Carta creada",
          description: message,
          variant: extractedCount > 0 ? "success" : "info",
        });

        if (isMulti) {
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

  const validSelection = mode === "single" ? !!cropRect : cropRects.length === EXPECTED_RECTS[mode];

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
              <div className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
                {MODE_OPTIONS.map((opt) => (
                  <SegmentButton
                    key={opt.value}
                    active={mode === opt.value}
                    onClick={() => {
                      setMode(opt.value);
                      setCropRects([]);
                      setCropRect(null);
                      const expected = EXPECTED_RECTS[opt.value];
                      setInfo(
                        opt.value === "single"
                          ? "Modo 1 cartón seleccionado."
                          : `Modo ${opt.value}. Dibuja ${expected} rectángulos.`,
                      );
                    }}
                  >
                    {opt.label}
                  </SegmentButton>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-name">Nombre del cartón</Label>
              <Input
                id="card-name"
                type="text"
                value={cardName}
                onChange={(event) => setCardName(event.target.value)}
                placeholder={mode === "single" ? "Cartón principal" : `CartonSemana (se guarda como /1..${EXPECTED_RECTS[mode]})`}
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-image">Imagen</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="card-image"
                  type="file"
                  accept="image/jpg,image/jpeg,image/png"
                  onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] file:mr-3 file:cursor-pointer file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-fg)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--color-fg-inverse)] hover:file:opacity-90"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowCamera(true)}
                  leftIcon={<CameraIcon className="h-4 w-4" />}
                  className="shrink-0"
                >
                  Usar cámara
                </Button>
              </div>
            </div>

            {previewUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-fg-muted)]">
                  {mode !== "single"
                    ? `Dibuja ${EXPECTED_RECTS[mode]} rectángulos (uno por cartón). ${cropRects.length}/${EXPECTED_RECTS[mode]} seleccionados.`
                    : "Dibuja un rectángulo sobre la grilla de celdas."}
                </p>
                <div
                  ref={containerRef}
                  className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2"
                >
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
                      <CropOverlay rect={cropRect} index={0} variant="confirmed" />
                    ) : null}
                    {mode !== "single"
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
                      if (mode !== "single") {
                        setCropRects([]);
                        setInfo(`Selecciona nuevamente los ${EXPECTED_RECTS[mode]} rectángulos.`);
                      } else {
                        setCropRect(null);
                        setInfo("Selecciona nuevamente el área de celdas.");
                      }
                    }}
                  >
                    Limpiar selección
                  </Button>
                  {mode !== "single" ? (
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

      {showCamera ? (
        <CameraCapture
          onCapture={(capturedFile) => {
            onFileChange(capturedFile);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      ) : null}
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

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 6h2l1.5-2h7L15 6h2a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="11" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
