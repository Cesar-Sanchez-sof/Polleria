"use client";

import React from "react";
import { Calendar, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { WidgetDateRange, DatePreset } from "@/lib/dashboards/widget-schema";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

const DATE_PRESETS: { preset: DatePreset; label: string }[] = [
  { preset: "today", label: "Hoy" },
  { preset: "yesterday", label: "Ayer" },
  { preset: "last7", label: "Últimos 7 días" },
  { preset: "last30", label: "Últimos 30 días" },
  { preset: "thisMonth", label: "Este mes" },
  { preset: "lastMonth", label: "Mes pasado" },
  { preset: "thisYear", label: "Este año" },
  { preset: "custom", label: "Rango personalizado" },
];

export function DateRangeWellSection({
  dateRange,
  isTransactional,
  defaultDateField,
  datasetFields,
  onUpdateDateRange,
}: {
  dateRange?: WidgetDateRange;
  isTransactional?: boolean;
  defaultDateField?: string;
  datasetFields: CatalogField[];
  onUpdateDateRange: (dateRange?: WidgetDateRange) => void;
}) {
  const dateFields = datasetFields.filter(
    (f) => f.dataType === "date" || Boolean(f.hasTime)
  );

  const activeField = dateRange?.field || defaultDateField || dateFields[0]?.id || "fecha";
  const activePreset = dateRange?.preset || "thisMonth";

  const handlePresetChange = (preset: DatePreset) => {
    onUpdateDateRange({
      field: activeField,
      preset,
      from: preset === "custom" ? dateRange?.from : undefined,
      to: preset === "custom" ? dateRange?.to : undefined,
    });
  };

  const handleFieldChange = (field: string) => {
    onUpdateDateRange({
      field,
      preset: activePreset,
      from: dateRange?.from,
      to: dateRange?.to,
    });
  };

  const handleCustomDateChange = (from?: string, to?: string) => {
    onUpdateDateRange({
      field: activeField,
      preset: "custom",
      from: from ?? dateRange?.from,
      to: to ?? dateRange?.to,
    });
  };

  return (
    <div className="space-y-2 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Calendar className="size-3.5 text-amber-500" />
          <span>Filtro de Fechas Relativas</span>
          {isTransactional && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-300">
              Obligatorio
            </Badge>
          )}
        </Label>
        {dateRange && !isTransactional && (
          <button
            type="button"
            onClick={() => onUpdateDateRange(undefined)}
            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            title="Quitar filtro de fechas"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {dateFields.length > 1 && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Campo de fecha:</span>
            <select
              value={activeField}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full h-7 text-xs rounded border border-input bg-background px-2 text-foreground"
            >
              {dateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Período (America/Lima):</span>
          <select
            value={activePreset}
            onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
            className="w-full h-7 text-xs rounded border border-input bg-background px-2 text-foreground font-medium"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.preset} value={p.preset}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {activePreset === "custom" && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div className="space-y-0.5">
              <span className="text-[9px] text-muted-foreground">Desde:</span>
              <Input
                type="date"
                value={dateRange?.from || ""}
                onChange={(e) => handleCustomDateChange(e.target.value, undefined)}
                className="h-7 text-[11px] px-1.5"
              />
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] text-muted-foreground">Hasta:</span>
              <Input
                type="date"
                value={dateRange?.to || ""}
                onChange={(e) => handleCustomDateChange(undefined, e.target.value)}
                className="h-7 text-[11px] px-1.5"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
