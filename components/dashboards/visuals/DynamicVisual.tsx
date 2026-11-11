"use client";

import React, { useMemo } from "react";
import { AlertCircle, AlertTriangle, Loader2, PieChart as PieIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useVisualData, useDashboardCatalog } from "@/lib/hooks/use-visual-data";
import type { WidgetConfig, VisualType } from "@/lib/dashboards/widget-schema";
import { getVisualRegistryEntry } from "@/lib/dashboards/visual-registry";
import { VISUAL_RENDERERS, BarColumnRenderer } from "./renderers";

interface DynamicVisualProps {
  config: WidgetConfig;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditMode?: boolean;
}

export function DynamicVisual({
  config,
  isSelected,
  onSelect,
  isEditMode,
}: DynamicVisualProps) {
  const { data, previousData, isLoading, error, isTruncated } = useVisualData(config.data);
  const { catalog } = useDashboardCatalog();

  const format = config.format;
  const visualType = config.visualType;
  const isUnconfigured = !config.data.dataset;
  const registryEntry = getVisualRegistryEntry(visualType);

  // Validación de pozos obligatorios según registro
  let incompleteMessage: string | null = null;
  if (!isUnconfigured) {
    for (const well of registryEntry.wells) {
      if (well.min > 0) {
        if (well.role === "axis" && !config.data.axis) {
          incompleteMessage = `Falta asignar: ${well.label}`;
          break;
        }
        if (well.role === "values" && (!config.data.values || config.data.values.length === 0)) {
          incompleteMessage = `Falta asignar: ${well.label}`;
          break;
        }
        if (well.role === "values_column" && !config.data.values.some((v) => v.series !== "line")) {
          incompleteMessage = `Falta asignar: ${well.label}`;
          break;
        }
        if (well.role === "values_x" && !config.data.values.some((v) => v.series === "x")) {
          incompleteMessage = `Falta asignar: ${well.label}`;
          break;
        }
        if (well.role === "values_y" && !config.data.values.some((v) => v.series === "y")) {
          incompleteMessage = `Falta asignar: ${well.label}`;
          break;
        }
      }
    }
  }

  const fieldLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (catalog) {
      for (const ds of catalog) {
        for (const f of ds.fields) {
          map.set(f.id, f.label);
        }
      }
    }
    return map;
  }, [catalog]);

  // Paleta de colores
  const palette =
    format.colors.custom && format.colors.custom.length > 0
      ? format.colors.custom
      : format.colors.series || ["#d97706", "#2563eb", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"];

  // Estilos del contenedor según config.format
  const containerStyle: React.CSSProperties = {
    backgroundColor: format.background?.color || "transparent",
    borderRadius: format.border?.radius ?? 12,
    borderWidth: format.border?.show ? (format.border?.width ?? 1) : 0,
    borderColor: format.border?.show
      ? format.border?.color || "var(--border)"
      : "transparent",
    borderStyle: format.border?.show ? "solid" : "none",
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode && onSelect) {
      e.stopPropagation();
      onSelect();
    }
  };

  const Renderer =
    visualType in VISUAL_RENDERERS
      ? VISUAL_RENDERERS[visualType as keyof typeof VISUAL_RENDERERS]
      : BarColumnRenderer;

  return (
    <div
      onClick={handleClick}
      style={containerStyle}
      className={`relative flex flex-col w-full h-full p-4 overflow-hidden select-none transition-all ${
        isEditMode ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "ring-2 ring-primary ring-offset-2 shadow-md"
          : "hover:shadow-xs"
      }`}
    >
      {/* 1. Cabecera del Visual: Título e Insignia de Truncado */}
      <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
        {format.title.show ? (
          <h4
            style={{
              fontSize: format.title.fontSize || 14,
              color: format.title.color || "inherit",
              textAlign: (format.title.align as React.CSSProperties["textAlign"]) || "left",
            }}
            className="font-semibold tracking-tight truncate flex-1"
          >
            {format.title.text || "Visual"}
          </h4>
        ) : (
          <div />
        )}

        {isTruncated && (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 gap-1 shrink-0"
            title="Se aplicó el límite de filas seguro para proteger el rendimiento"
          >
            <AlertTriangle className="size-3" />
            <span>Datos truncados</span>
          </Badge>
        )}
      </div>

      {/* 2. Cuerpo del Visual según estado */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">
        {/* ESTADO A: No configurado */}
        {isUnconfigured && (
          <div className="flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/80 rounded-lg w-full h-full bg-muted/20">
            <PieIcon className="size-8 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-medium text-foreground">Visual sin configurar</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Selecciona un tipo de visual y asigna campos
            </p>
          </div>
        )}

        {/* ESTADO B: Visual incompleto (Falta asignar pozo requerido) */}
        {!isUnconfigured && incompleteMessage && (
          <div className="flex flex-col items-center justify-center text-center p-4 border border-dashed border-amber-300 rounded-lg w-full h-full bg-amber-500/5">
            <AlertCircle className="size-6 text-amber-500 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{incompleteMessage}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Asigna los campos requeridos en el panel de propiedades
            </p>
          </div>
        )}

        {/* ESTADO C: Cargando */}
        {!isUnconfigured && !incompleteMessage && isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Cargando datos...</span>
          </div>
        )}

        {/* ESTADO D: Error */}
        {!isUnconfigured && !incompleteMessage && !isLoading && error && (
          <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 w-full max-w-sm">
            <AlertCircle className="size-5 mb-1 shrink-0" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        {/* ESTADO E: Sin datos */}
        {!isUnconfigured && !incompleteMessage && !isLoading && !error && (!data || data.rows.length === 0) && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <p className="text-xs font-medium">Sin datos para mostrar con los filtros aplicados</p>
          </div>
        )}

        {/* ESTADO F: Renderizado de Datos Exitoso */}
        {!isUnconfigured && !incompleteMessage && !isLoading && !error && data && data.rows.length > 0 && (
          <Renderer
            visualType={visualType}
            config={config}
            data={data}
            previousData={previousData}
            format={format}
            palette={palette}
            fieldLabelsMap={fieldLabelsMap}
          />
        )}
      </div>
    </div>
  );
}
