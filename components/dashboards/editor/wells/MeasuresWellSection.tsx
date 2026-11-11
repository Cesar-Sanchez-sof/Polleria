"use client";

import React from "react";
import { Hash, Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MeasureAggregation, WidgetValueField } from "@/lib/dashboards/widget-schema";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

export function MeasuresWellSection({
  title = "Valores (Medidas)",
  required = true,
  measures,
  availableMeasures,
  filterSeries,
  defaultSeries,
  showSeriesToggle = false,
  onAddMeasure,
  onRemoveMeasure,
  onUpdateAggregation,
  onToggleSeries,
}: {
  title?: string;
  required?: boolean;
  measures: WidgetValueField[];
  availableMeasures: CatalogField[];
  filterSeries?: "column" | "line";
  defaultSeries?: "column" | "line";
  showSeriesToggle?: boolean;
  onAddMeasure: (fieldId: string, series?: "column" | "line") => void;
  onRemoveMeasure: (index: number) => void;
  onUpdateAggregation: (index: number, agg: MeasureAggregation) => void;
  onToggleSeries?: (index: number, series: "column" | "line") => void;
}) {
  const displayedMeasures = filterSeries
    ? measures
        .map((m, originalIdx) => ({ ...m, originalIdx }))
        .filter((m) => (m.series || "column") === filterSeries)
    : measures.map((m, originalIdx) => ({ ...m, originalIdx }));

  return (
    <div className="space-y-1.5 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span>{title}</span>
          {required && <span className="text-destructive">*</span>}
        </Label>
        <AddMeasurePopover
          measures={availableMeasures}
          onSelectMeasure={(fieldId) => onAddMeasure(fieldId, defaultSeries)}
        />
      </div>

      {displayedMeasures.length > 0 ? (
        <div className="space-y-1.5 mt-2">
          {displayedMeasures.map((val) => {
            const catalogField = availableMeasures.find((m) => m.id === val.field);
            const allowedAggs = catalogField?.allowedAggregations || [
              "sum",
              "avg",
              "count",
              "min",
              "max",
              "countDistinct",
            ];
            const isCalculated = Boolean(catalogField?.isCalculated);

            return (
              <div
                key={`${val.field}-${val.originalIdx}`}
                className="flex items-center justify-between gap-1.5 p-1.5 bg-background border border-border/90 rounded-md text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Hash className="size-3 text-primary shrink-0" />
                  <span className="truncate font-medium text-[11px]" title={catalogField?.label || val.field}>
                    {catalogField?.label || val.field}
                  </span>
                </div>

                {/* Toggle de Serie para Combo */}
                {showSeriesToggle && onToggleSeries && (
                  <select
                    value={val.series || "column"}
                    onChange={(e) =>
                      onToggleSeries(val.originalIdx, e.target.value as "column" | "line")
                    }
                    className="h-6 text-[10px] border border-input rounded bg-background px-1 text-foreground"
                    title="Tipo de serie en gráfico combinado"
                  >
                    <option value="column">Columna</option>
                    <option value="line">Línea</option>
                  </select>
                )}

                {/* Selector de agregación */}
                <select
                  value={val.agg}
                  disabled={isCalculated}
                  onChange={(e) =>
                    onUpdateAggregation(val.originalIdx, e.target.value as MeasureAggregation)
                  }
                  className="h-6 text-[10px] font-mono border border-input rounded bg-muted/30 px-1 text-foreground"
                  title={isCalculated ? "Medida calculada: agregación fija" : "Cambiar agregación"}
                >
                  {allowedAggs.map((agg) => (
                    <option key={agg} value={agg}>
                      {agg}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onRemoveMeasure(val.originalIdx)}
                  className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  title="Quitar medida"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/80 italic mt-1">
          {required ? "Sin medidas asignadas. Agrega al menos una." : "Opcional. Haz clic en '+' para agregar."}
        </p>
      )}
    </div>
  );
}

export function AddMeasurePopover({
  measures,
  onSelectMeasure,
}: {
  measures: CatalogField[];
  onSelectMeasure: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer">
        <Plus className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5 max-h-64 overflow-y-auto">
        <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
          Seleccionar Medida
        </div>
        {measures.length === 0 ? (
          <div className="text-xs text-muted-foreground p-2 text-center">
            No hay medidas numéricas disponibles
          </div>
        ) : (
          <div className="space-y-0.5">
            {measures.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectMeasure(m.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                <Hash className="size-3 text-primary shrink-0" />
                <span className="truncate flex-1">{m.label}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
