"use client";

import React from "react";
import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { WidgetSort, WidgetValueField } from "@/lib/dashboards/widget-schema";

export function SortAndLimitSection({
  sort,
  limit,
  axisField,
  measures,
  onUpdateSort,
  onUpdateLimit,
}: {
  sort?: WidgetSort;
  limit?: number;
  axisField?: string;
  measures: WidgetValueField[];
  onUpdateSort: (s?: WidgetSort) => void;
  onUpdateLimit: (l?: number) => void;
}) {
  const sortOptions: { by: string; label: string }[] = [];
  if (axisField) {
    sortOptions.push({ by: axisField, label: `Eje (${axisField})` });
  }
  measures.forEach((m) => {
    sortOptions.push({
      by: `${m.field}_${m.agg}`,
      label: `${m.field} (${m.agg})`,
    });
  });

  const currentSortBy = sort?.by || sortOptions[0]?.by || "";
  const currentDir = sort?.dir || "desc";

  return (
    <div className="space-y-2 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">Orden y Límite (Top N)</Label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Ordenar por:</span>
          <select
            value={currentSortBy}
            disabled={sortOptions.length === 0}
            onChange={(e) =>
              onUpdateSort({
                by: e.target.value,
                dir: currentDir,
              })
            }
            className="w-full h-7 text-[11px] rounded border border-input bg-background px-1.5 text-foreground truncate"
          >
            {sortOptions.map((opt) => (
              <option key={opt.by} value={opt.by}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Sentido:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUpdateSort({ by: currentSortBy, dir: "asc" })}
              className={`flex-1 h-7 rounded border text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                currentDir === "asc"
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "bg-background border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDownAZ className="size-3" />
              <span>ASC</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSort({ by: currentSortBy, dir: "desc" })}
              className={`flex-1 h-7 rounded border text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                currentDir === "desc"
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "bg-background border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUpZA className="size-3" />
              <span>DESC</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Límite de grupos (Top N):</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {limit ? `${limit} filas` : "Sin límite"}
          </span>
        </div>
        <Input
          type="number"
          min={1}
          max={1000}
          placeholder="Sin límite"
          value={limit || ""}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : undefined;
            onUpdateLimit(val && val > 0 ? val : undefined);
          }}
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
