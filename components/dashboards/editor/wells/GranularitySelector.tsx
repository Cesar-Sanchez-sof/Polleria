"use client";

import React from "react";
import type { DateGranularity } from "@/lib/dashboards/widget-schema";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

export function GranularitySelector({
  axisFieldId,
  currentGranularity,
  datasetFields,
  onSelectGranularity,
}: {
  axisFieldId: string;
  currentGranularity?: DateGranularity;
  datasetFields: CatalogField[];
  onSelectGranularity: (g: DateGranularity) => void;
}) {
  const field = datasetFields.find((f) => f.id === axisFieldId);
  const isDate = field?.dataType === "date" || Boolean(field?.hasTime);

  if (!isDate) return null;

  const supported = field?.supportedGranularities || [
    "year",
    "quarter",
    "month",
    "weekday",
    "day",
    "hour",
    "hourOfDay",
  ];

  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <span className="text-[10px] text-muted-foreground font-medium">Granularidad:</span>
      <select
        value={currentGranularity || "month"}
        onChange={(e) => onSelectGranularity(e.target.value as DateGranularity)}
        className="h-6 text-[11px] border border-input rounded bg-background px-1.5 text-foreground"
      >
        {supported.map((g) => (
          <option key={g} value={g}>
            {g === "hourOfDay"
              ? "Hora del Día (Lima)"
              : g === "month"
              ? "Mes"
              : g === "day"
              ? "Día"
              : g === "weekday"
              ? "Día de la semana"
              : g === "quarter"
              ? "Trimestre"
              : g === "year"
              ? "Año"
              : g}
          </option>
        ))}
      </select>
    </div>
  );
}
