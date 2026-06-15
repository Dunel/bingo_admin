"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

type Grid = (number | null)[][];
type CardMode = "x1" | "x2" | "x4" | "x6";

type CardResult = {
  index: number;
  success: boolean;
  grid?: Grid;
  confidence?: number;
  extractedCount?: number;
  numbers?: number[];
  error?: string;
};

type TestResult = {
  success: boolean;
  cards?: CardResult[];
  elapsed?: number;
  error?: string;
};

export default function TestOcrPage() {
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CardMode>("x1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(file);
    setResult(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleModeChange(newMode: CardMode) {
    setMode(newMode);
    setResult(null);
  }

  async function handleSubmit() {
    if (!image) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", image);
      formData.append("mode", mode);

      const response = await fetch("/api/test/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setImage(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-fg)]">Prueba OCR de Bingo</h1>
          <p className="mt-2 text-[var(--color-fg-muted)]">
            Sube una imagen de cartones de bingo para probar el reconocimiento sin guardarlos en la base de datos.
          </p>
        </div>

        {/* Mode Selector */}
        <Card className="mb-6">
          <CardBody>
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--color-fg)]">Modo de procesamiento:</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "x1", label: "1 cartón", desc: "Una imagen, un cartón" },
                  { value: "x2", label: "2 cartones", desc: "Una imagen, dos cartones" },
                  { value: "x4", label: "4 cartones", desc: "Una imagen, cuatro cartones" },
                  { value: "x6", label: "6 cartones", desc: "Una imagen, seis cartones" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleModeChange(option.value)}
                    className={cn(
                      "flex-1 min-w-[140px] rounded-lg border-2 p-3 text-left transition-all",
                      mode === option.value
                        ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)]/10"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
                    )}
                  >
                    <p className={cn(
                      "font-semibold",
                      mode === option.value ? "text-[var(--color-brand-600)]" : "text-[var(--color-fg)]"
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-[var(--color-fg-muted)]">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Panel izquierdo: Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Imagen del cartón</CardTitle>
              <CardDescription>Sube una imagen JPG o PNG del cartón de bingo</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-fg)]">
                  Seleccionar imagen
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileChange}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] file:mr-4 file:rounded-md file:border-0 file:bg-[var(--color-brand-600)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--color-brand-700)]"
                />
              </div>

              {previewUrl && (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-96 w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmit} disabled={loading} loading={loading} fullWidth>
                      {loading ? "Procesando..." : "Procesar OCR"}
                    </Button>
                    <Button variant="outline" onClick={handleReset} disabled={loading}>
                      Limpiar
                    </Button>
                  </div>
                </div>
              )}

              {!previewUrl && (
                <EmptyState
                  title="Sin imagen"
                  description="Selecciona una imagen para comenzar"
                  icon={
                    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
              )}
            </CardBody>
          </Card>

          {/* Panel derecho: Resultados */}
          <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>Números detectados y métricas del OCR</CardDescription>
            </CardHeader>
            <CardBody>
              {!result && !loading && (
                <EmptyState
                  title="Sin resultados"
                  description="Procesa una imagen para ver los resultados"
                  icon={
                    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  }
                />
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-brand-600)]" />
                  <p className="mt-4 text-sm text-[var(--color-fg-muted)]">Procesando imagen...</p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-6">
                  {/* Métricas globales */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-center">
                      <p className="text-2xl font-bold text-[var(--color-fg)]">
                        {result.cards?.reduce((sum, card) => sum + (card.extractedCount ?? 0), 0) ?? 0}
                      </p>
                      <p className="text-xs text-[var(--color-fg-muted)]">Números</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-center">
                      <p className="text-2xl font-bold text-[var(--color-fg)]">
                        {result.cards?.filter((c) => c.success).length ?? 0}/{result.cards?.length ?? 0}
                      </p>
                      <p className="text-xs text-[var(--color-fg-muted)]">Exitosos</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-center">
                      <p className="text-2xl font-bold text-[var(--color-fg)]">
                        {result.elapsed ?? 0}ms
                      </p>
                      <p className="text-xs text-[var(--color-fg-muted)]">Tiempo</p>
                    </div>
                  </div>

                  {/* Estado global */}
                  {result.success ? (
                    <Badge variant="success" size="md">
                      ✓ Procesamiento exitoso
                    </Badge>
                  ) : (
                    <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3">
                      <p className="text-sm font-medium text-[var(--color-danger-fg)]">
                        ✗ Error: {result.error}
                      </p>
                    </div>
                  )}

                  {/* Resultados por cartón */}
                  {result.success && result.cards && result.cards.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-[var(--color-fg)]">
                        Resultados por cartón:
                      </p>
                      <div className={cn(
                        "grid gap-4",
                        result.cards.length === 1 && "grid-cols-1",
                        result.cards.length === 2 && "grid-cols-1 md:grid-cols-2",
                        result.cards.length === 4 && "grid-cols-1 md:grid-cols-2",
                        result.cards.length === 6 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                      )}>
                        {result.cards.map((card) => (
                          <div
                            key={card.index}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-semibold text-[var(--color-fg)]">
                                Cartón {card.index}
                              </h4>
                              {card.success ? (
                                <Badge variant="success" size="sm">
                                  ✓
                                </Badge>
                              ) : (
                                <Badge variant="danger" size="sm">
                                  ✗
                                </Badge>
                              )}
                            </div>

                            {card.success && card.grid ? (
                              <>
                                {/* Métricas del cartón */}
                                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                                  <div className="rounded bg-[var(--color-surface)] p-2 text-center">
                                    <p className="font-bold text-[var(--color-fg)]">
                                      {card.extractedCount ?? 0}
                                    </p>
                                    <p className="text-[var(--color-fg-muted)]">Números</p>
                                  </div>
                                  <div className="rounded bg-[var(--color-surface)] p-2 text-center">
                                    <p className="font-bold text-[var(--color-fg)]">
                                      {card.confidence?.toFixed(0) ?? 0}%
                                    </p>
                                    <p className="text-[var(--color-fg-muted)]">Confianza</p>
                                  </div>
                                </div>

                                {/* Grilla visual */}
                                <div className="mb-3 grid grid-cols-5 gap-1">
                                  {card.grid.map((row, rowIdx) =>
                                    row.map((cell, colIdx) => {
                                      const isCenter = rowIdx === 2 && colIdx === 2;
                                      return (
                                        <div
                                          key={`${rowIdx}-${colIdx}`}
                                          className={cn(
                                            "flex aspect-square items-center justify-center rounded border text-xs font-bold",
                                            isCenter
                                              ? "border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]"
                                              : cell !== null
                                              ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white"
                                              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]"
                                          )}
                                        >
                                          {isCenter ? "FREE" : cell ?? ""}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {/* Números detectados */}
                                {card.numbers && card.numbers.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {card.numbers.map((num) => (
                                      <span
                                        key={num}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-xs font-bold text-white"
                                      >
                                        {num}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-[var(--color-danger-fg)]">
                                {card.error ?? "No se detectaron números"}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Información adicional */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm text-[var(--color-fg-muted)]">
              <li>• Esta página no guarda datos en la base de datos</li>
              <li>• El OCR usa Tesseract.js con múltiples variantes de preprocesamiento</li>
              <li>• Se detectan automáticamente los bordes de la grilla</li>
              <li>• Los números se validan según el rango de cada columna (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)</li>
              <li>• En modo multi-cartón, todos los cartones se procesan en paralelo</li>
              <li>• Revisa la consola del servidor para ver logs detallados del OCR</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
