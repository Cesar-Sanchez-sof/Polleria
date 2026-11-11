"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  Database,
  Type,
  Calendar,
  Hash,
  Search,
  GripVertical,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { setDraggedField } from "@/lib/dashboards/drag-state";
import {
  validateFieldForWell,
  type VisualWellDefinition,
} from "@/lib/dashboards/visual-registry";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

export function FieldsTreeSection({
  datasetLabel,
  dimensions,
  measures,
  axisWellDef,
  legendWellDef,
  valuesWellDef,
  currentAxis,
  currentLegend,
  currentValuesCount,
  onAssignDimension,
  onAssignMeasure,
}: {
  datasetLabel?: string;
  dimensions: CatalogField[];
  measures: CatalogField[];
  axisWellDef?: VisualWellDefinition;
  legendWellDef?: VisualWellDefinition;
  valuesWellDef?: VisualWellDefinition;
  currentAxis?: string;
  currentLegend?: string;
  currentValuesCount: number;
  onAssignDimension: (wellRole: "axis" | "legend", fieldId: string) => void;
  onAssignMeasure: (fieldId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState("");

  const filteredDimensions = useMemo(() => {
    if (!search.trim()) return dimensions;
    const q = search.toLowerCase();
    return dimensions.filter(
      (d) => d.label.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
    );
  }, [dimensions, search]);

  const filteredMeasures = useMemo(() => {
    if (!search.trim()) return measures;
    const q = search.toLowerCase();
    return measures.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [measures, search]);

  const totalFields = dimensions.length + measures.length;

  const handleQuickAddDimension = (dim: CatalogField) => {
    // 1. Intentar asignar a axis si está vacío
    if (axisWellDef && !currentAxis) {
      const v = validateFieldForWell(axisWellDef, dim, 0);
      if (v.valid) {
        onAssignDimension("axis", dim.id);
        toast.success(`"${dim.label}" asignado al ${axisWellDef.label}`);
        return;
      }
    }

    // 2. Intentar asignar a legend si axis está ocupado y legend existe
    if (legendWellDef && !currentLegend && currentAxis !== dim.id) {
      const v = validateFieldForWell(legendWellDef, dim, 0);
      if (v.valid) {
        onAssignDimension("legend", dim.id);
        toast.success(`"${dim.label}" asignado a Leyenda`);
        return;
      }
    }

    // Si ambos están ocupados o no disponibles
    if (axisWellDef && currentAxis) {
      toast.error(`El pozo "${axisWellDef.label}" ya contiene un campo. Arrástralo sobre el pozo o remueve el actual.`);
    } else {
      toast.error("Este visual no acepta más dimensiones.");
    }
  };

  const handleQuickAddMeasure = (m: CatalogField) => {
    if (!valuesWellDef) {
      toast.error("Este visual no admite medidas.");
      return;
    }

    const v = validateFieldForWell(valuesWellDef, m, currentValuesCount);
    if (!v.valid) {
      toast.error(v.error || "No se puede agregar más medidas a este visual.");
      return;
    }

    onAssignMeasure(m.id);
    toast.success(`"${m.label}" agregada a ${valuesWellDef.label}`);
  };

  return (
    <div className="pt-2 border-t border-border/70 space-y-2">
      {/* Cabecera Colapsable */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground hover:text-primary transition-colors cursor-pointer select-none"
        >
          <Database className="size-3.5 text-primary" />
          <span>Campos ({totalFields})</span>
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "" : "-rotate-90"
            }`}
          />
        </button>
        {datasetLabel && (
          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-normal">
            {datasetLabel}
          </Badge>
        )}
      </div>

      {isOpen && (
        <div className="space-y-2.5 pt-1">
          {/* Buscador de campos */}
          <div className="relative">
            <Search className="absolute left-2 top-2 size-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar dimensiones y medidas..."
              className="w-full h-7 pl-6 pr-2 text-[11px] rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          <p className="text-[10px] text-muted-foreground italic px-0.5">
            Arrastra los campos hacia los pozos superiores para asignarlos.
          </p>

          {/* Dimensiones */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Type className="size-3 text-blue-500" />
                Dimensiones ({filteredDimensions.length})
              </span>
            </div>

            <div className="space-y-0.5 border border-border/60 rounded-md p-1 bg-muted/10 max-h-48 overflow-y-auto">
              {filteredDimensions.length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-2 italic">
                  {search ? "Sin coincidencias" : "Sin dimensiones"}
                </div>
              ) : (
                filteredDimensions.map((dim) => {
                  const isDate = dim.dataType === "date" || dim.hasTime;
                  const Icon = isDate ? Calendar : Type;
                  const isAssigned = currentAxis === dim.id || currentLegend === dim.id;

                  return (
                    <div
                      key={dim.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedField(dim);
                        e.dataTransfer.setData("application/json", JSON.stringify(dim));
                        e.dataTransfer.setData("text/plain", dim.id);
                        e.dataTransfer.effectAllowed = "copyMove";
                      }}
                      onDragEnd={() => {
                        setDraggedField(null);
                      }}
                      className={`flex items-center justify-between p-1 rounded-md text-xs group cursor-grab active:cursor-grabbing border border-transparent transition-all select-none ${
                        isAssigned
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/80 text-foreground"
                      }`}
                      title={`${dim.label} (${dim.dataType || "texto"}) - Arrastra a un pozo`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical className="size-3 text-muted-foreground/50 shrink-0 group-hover:text-foreground" />
                        <Icon className="size-3 text-blue-500 shrink-0" />
                        <span className="truncate text-[11px]">{dim.label}</span>
                      </div>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleQuickAddDimension(dim)}
                        title="Asignar al pozo de dimensión"
                        className="size-5 opacity-0 group-hover:opacity-100 hover:bg-background cursor-pointer shrink-0"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Medidas */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Hash className="size-3 text-primary" />
                Medidas ({filteredMeasures.length})
              </span>
            </div>

            <div className="space-y-0.5 border border-border/60 rounded-md p-1 bg-muted/10 max-h-48 overflow-y-auto">
              {filteredMeasures.length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-2 italic">
                  {search ? "Sin coincidencias" : "Sin medidas"}
                </div>
              ) : (
                filteredMeasures.map((m) => {
                  return (
                    <div
                      key={m.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedField(m);
                        e.dataTransfer.setData("application/json", JSON.stringify(m));
                        e.dataTransfer.setData("text/plain", m.id);
                        e.dataTransfer.effectAllowed = "copyMove";
                      }}
                      onDragEnd={() => {
                        setDraggedField(null);
                      }}
                      className="flex items-center justify-between p-1 rounded-md text-xs group cursor-grab active:cursor-grabbing border border-transparent hover:bg-muted/80 text-foreground transition-all select-none"
                      title={`${m.label} (numérico) - Arrastra a un pozo de valores`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical className="size-3 text-muted-foreground/50 shrink-0 group-hover:text-foreground" />
                        <Hash className="size-3 text-primary shrink-0" />
                        <span className="truncate text-[11px] font-medium">{m.label}</span>
                      </div>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleQuickAddMeasure(m)}
                        title="Agregar a valores"
                        className="size-5 opacity-0 group-hover:opacity-100 hover:bg-background cursor-pointer shrink-0"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
