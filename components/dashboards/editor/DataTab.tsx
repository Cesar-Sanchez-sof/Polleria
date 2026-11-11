"use client";

import React from "react";
import { Plus, Type, Hash, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import type { CatalogDataset, CatalogField } from "@/lib/hooks/use-visual-data";

export function DataTab({
  widgetId,
  currentDataset,
  dimensions,
  measures,
}: {
  widgetId: string;
  currentDataset?: CatalogDataset;
  dimensions: CatalogField[];
  measures: CatalogField[];
}) {
  const { assignFieldToWell } = useDashboardEditorStore();

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-24 m-0">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-semibold text-foreground">Catálogo de Campos</span>
        <Badge variant="outline" className="text-[10px] h-5">
          {currentDataset?.label || "Sin dataset"}
        </Badge>
      </div>

      {!currentDataset ? (
        <p className="text-xs text-muted-foreground italic">
          Selecciona un origen de datos en la parte superior para explorar sus campos.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Dimensiones */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Type className="size-3 text-blue-500" />
              <span>Dimensiones ({dimensions.length})</span>
            </Label>
            <div className="space-y-1 border border-border/70 rounded-md p-1.5 bg-muted/10">
              {dimensions.map((dim) => {
                const isDate = dim.dataType === "date" || dim.hasTime;
                const Icon = isDate ? Calendar : Type;

                return (
                  <div
                    key={dim.id}
                    className="flex items-center justify-between p-1 rounded hover:bg-muted/50 text-xs group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="size-3 text-blue-500 shrink-0" />
                      <span className="truncate text-[11px] font-medium" title={dim.description || dim.label}>
                        {dim.label}
                      </span>
                    </div>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => assignFieldToWell(widgetId, "axis", dim.id)}
                      title="Asignar al Eje principal"
                      className="size-5 opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Medidas */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Hash className="size-3 text-primary" />
              <span>Medidas ({measures.length})</span>
            </Label>
            <div className="space-y-1 border border-border/70 rounded-md p-1.5 bg-muted/10">
              {measures.map((m) => {
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-1 rounded hover:bg-muted/50 text-xs group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Hash className="size-3 text-primary shrink-0" />
                      <span className="truncate text-[11px] font-medium" title={m.description || m.label}>
                        {m.label}
                      </span>
                    </div>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => assignFieldToWell(widgetId, "values", m.id)}
                      title="Agregar a Valores"
                      className="size-5 opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
