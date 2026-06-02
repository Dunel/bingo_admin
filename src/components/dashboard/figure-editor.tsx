"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  type FigureMode,
  type FigurePattern,
  createEmptyPattern,
  clonePattern,
  countPatternCells,
  patternKey,
} from "@/hooks/use-figure-engine";

export interface SavedFigure {
  id: string;
  name: string;
  pattern: FigurePattern;
}

export interface FigureEditorProps {
  mode: FigureMode;
  onModeChange: (mode: FigureMode) => void;
  draft: FigurePattern;
  onToggleCell: (row: number, col: number) => void;
  onClearDraft: () => void;
  onAddFigure: () => void;
  savedFigures: SavedFigure[];
  selectedFigureIds: string[];
  onToggleFigureSelection: (id: string) => void;
  onRemoveFigure: (id: string) => void;
  draftCellCount: number;
}

export function FigureEditor({
  mode,
  onModeChange,
  draft,
  onToggleCell,
  onClearDraft,
  onAddFigure,
  savedFigures,
  selectedFigureIds,
  onToggleFigureSelection,
  onRemoveFigure,
  draftCellCount,
}: FigureEditorProps) {
  const selectedSet = React.useMemo(() => new Set(selectedFigureIds), [selectedFigureIds]);

  const isDuplicate = React.useMemo(() => {
    const key = patternKey(draft);
    return savedFigures.some((f) => patternKey(f.pattern) === key);
  }, [draft, savedFigures]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Figura de bingo</CardTitle>
            <CardDescription>
              Define la figura a buscar o valida cartón lleno.
            </CardDescription>
          </div>
          <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
            <SegmentButton
              active={mode === "custom"}
              onClick={() => onModeChange("custom")}
              icon={<ShapeIcon className="h-3.5 w-3.5" />}
            >
              Figura
            </SegmentButton>
            <SegmentButton
              active={mode === "full"}
              onClick={() => onModeChange("full")}
              icon={<GridIcon className="h-3.5 w-3.5" />}
            >
              Cartón lleno
            </SegmentButton>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {mode === "custom" ? (
          <>
            <p className="text-sm text-[var(--color-fg-muted)]">
              Dibuja una figura y agrégala. Puedes guardar y combinar varias figuras.
            </p>
            <div
              role="group"
              aria-label="Editor de figura"
              className="inline-grid grid-cols-5 gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2"
            >
              {draft.flatMap((row, rowIndex) =>
                row.map((isSelected, colIndex) => {
                  const isCenter = rowIndex === 2 && colIndex === 2;
                  return (
                    <button
                      key={`figure-${rowIndex}-${colIndex}`}
                      type="button"
                      onClick={() => onToggleCell(rowIndex, colIndex)}
                      aria-label={`Celda ${rowIndex + 1},${colIndex + 1}`}
                      aria-pressed={isCenter || isSelected}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded text-xs font-bold transition-all duration-150",
                        "hover:scale-105 active:scale-95",
                        isCenter
                          ? "border border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-fg-inverse)]"
                          : isSelected
                            ? "bg-[var(--color-brand-500)] text-white shadow-sm"
                            : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-subtle)] hover:border-[var(--color-border-focus)]",
                      )}
                    >
                      {isCenter ? "F" : isSelected ? "X" : "·"}
                    </button>
                  );
                }),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={onAddFigure}
                disabled={draftCellCount === 0 || isDuplicate}
                leftIcon={<PlusIcon className="h-3.5 w-3.5" />}
              >
                {isDuplicate ? "Ya guardada" : "Agregar figura"}
              </Button>
              <Button size="sm" variant="outline" onClick={onClearDraft}>
                Limpiar dibujo
              </Button>
              <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
                Celdas en dibujo: {draftCellCount}
              </span>
            </div>

            {savedFigures.length > 0 ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  Figuras guardadas
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {savedFigures.map((figure) => {
                    const selected = selectedSet.has(figure.id);
                    return (
                      <li
                        key={figure.id}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-2 py-1.5 text-xs font-semibold transition-all",
                          selected
                            ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/30 dark:text-[var(--color-brand-200)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]",
                        )}
                      >
                        <FigureThumb pattern={figure.pattern} />
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleFigureSelection(figure.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-brand-600)]"
                          />
                          <span>
                            {figure.name} ({countPatternCells(figure.pattern)})
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => onRemoveFigure(figure.id)}
                          className="ml-1 rounded p-0.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-fg)] transition-colors"
                          aria-label={`Eliminar ${figure.name}`}
                        >
                          <XSmallIcon className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--color-fg-muted)]">
            Se validan todas las celdas del cartón (incluyendo el centro libre).
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function FigureThumb({ pattern }: { pattern: FigurePattern }) {
  return (
    <div className="inline-grid grid-cols-5 gap-[2px] rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-1" aria-hidden="true">
      {pattern.flatMap((row, rowIndex) =>
        row.map((isFilled, colIndex) => {
          const isCenter = rowIndex === 2 && colIndex === 2;
          const active = isCenter || isFilled;
          return (
            <span
              key={`thumb-${rowIndex}-${colIndex}`}
              className={cn(
                "h-1.5 w-1.5 rounded-sm border",
                active
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-400)]"
                  : "border-[var(--color-border)] bg-transparent",
              )}
            />
          );
        }),
      )}
    </div>
  );
}

interface SegmentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  icon?: React.ReactNode;
}

function SegmentButton({ active, icon, children, className, ...props }: SegmentButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition-all",
        active
          ? "bg-[var(--color-surface)] text-[var(--color-fg)] shadow-sm"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

function ShapeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2 2h3v3H2zM11 2h3v3h-3zM2 11h3v3H2zM6.5 6.5h3v3h-3zM11 11h3v3h-3z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function XSmallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
