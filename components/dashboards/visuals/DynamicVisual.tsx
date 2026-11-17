"use client";

import React, { useMemo } from "react";
import { AlertCircle, AlertTriangle, Loader2, PieChart as PieIcon, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useVisualData, useDashboardCatalog } from "@/lib/hooks/use-visual-data";
import type { WidgetConfig } from "@/lib/dashboards/widget-schema";
import { getVisualRegistryEntry } from "@/lib/dashboards/visual-registry";
import { VISUAL_RENDERERS, BarColumnRenderer } from "./renderers";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { resolveCrossFilterDateRange } from "@/lib/dashboards/date-utils";
import { useShareMode } from "@/components/dashboards/share-mode-context";
import { resolveDashboardImageUrl } from "@/lib/dashboards/image-utils";
import { cn } from "@/lib/utils";

interface DynamicVisualProps {
  config: WidgetConfig;
  widgetId?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditMode?: boolean;
  isShareMode?: boolean;
}

export function DynamicVisual({
  config,
  widgetId,
  isSelected,
  onSelect,
  isEditMode,
  isShareMode,
}: DynamicVisualProps) {
  const ctx = useShareMode();
  const isShare = isShareMode ?? ctx;

  const { data, previousData, isLoading, error, isTruncated, hasCrossFilterApplied } = useVisualData(
    config.data,
    widgetId
  );
  const { catalog } = useDashboardCatalog();
  const crossFilters = useDashboardEditorStore((s) => s.crossFilters);
  const setCrossFilter = useDashboardEditorStore((s) => s.setCrossFilter);
  const clearCrossFilters = useDashboardEditorStore((s) => s.clearCrossFilters);

  const format = config.format;
  const visualType = config.visualType;

  // useMemo debe estar ANTES de cualquier early return (Regla de Hooks)
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

  // Soporte directo para widgets estáticos (text, divider, image)
  if ((visualType as string) === "text") {
    const content = (config as Record<string, unknown>).content || "";
    const rawFontSize = (config as Record<string, unknown>).fontSize;
    const fontSizeNum =
      typeof rawFontSize === "number"
        ? rawFontSize
        : typeof rawFontSize === "string"
          ? parseInt(rawFontSize, 10) || 14
          : 14;
    const bold = Boolean((config as Record<string, unknown>).bold);
    const italic = Boolean((config as Record<string, unknown>).italic);
    const underline = Boolean((config as Record<string, unknown>).underline);
    const align = ((config as Record<string, unknown>).align || "left") as "left" | "center" | "right";
    const fontFamily = String((config as Record<string, unknown>).fontFamily || "Inter");
    const color = String((config as Record<string, unknown>).color || "");
    const subtitle = String((config as Record<string, unknown>).subtitle || "");
    const letterSpacing = String((config as Record<string, unknown>).letterSpacing || "normal");
    const textTransform = String((config as Record<string, unknown>).textTransform || "none");
    const backgroundVariant = String((config as Record<string, unknown>).backgroundVariant || "transparent");
    const verticalAlign = String((config as Record<string, unknown>).verticalAlign || "center");

    const getFontFamilyCss = (font: string) => {
      switch (font.toLowerCase()) {
        case "serif":
        case "playfair":
          return "'Playfair Display', Georgia, 'Times New Roman', serif";
        case "roboto":
          return "'Roboto', sans-serif";
        case "arial":
          return "Arial, Helvetica, sans-serif";
        case "montserrat":
          return "'Montserrat', sans-serif";
        case "inter":
        default:
          return "var(--font-sans), Inter, sans-serif";
      }
    };

    const getLetterSpacingCss = (ls: string) => {
      switch (ls) {
        case "wide": return "0.05em";
        case "wider": return "0.12em";
        case "widest": return "0.2em";
        case "normal":
        default: return "normal";
      }
    };

    const getBackgroundVariantClass = (bv: string) => {
      switch (bv) {
        case "card":
          return "bg-card border border-border/80 shadow-xs rounded-xl";
        case "accent":
          return "bg-primary/5 border border-primary/20 rounded-xl";
        case "gradient":
          return "bg-gradient-to-r from-primary/10 via-amber-500/10 to-transparent border border-primary/20 rounded-xl";
        case "transparent":
        default:
          return "bg-transparent border-none shadow-none";
      }
    };

    const lineHeight = fontSizeNum >= 32 ? 1.15 : fontSizeNum >= 20 ? 1.3 : 1.5;
    const paddingV = Math.max(4, Math.round(fontSizeNum * 0.2));
    const paddingH = Math.max(8, Math.round(fontSizeNum * 0.3));

    return (
      <div
        onClick={onSelect}
        className={cn(
          "w-full h-full flex overflow-hidden select-text transition-all",
          verticalAlign === "top" ? "items-start" : verticalAlign === "bottom" ? "items-end" : "items-center",
          getBackgroundVariantClass(backgroundVariant)
        )}
      >
        <div
          style={{
            fontSize: `${fontSizeNum}px`,
            lineHeight,
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? "italic" : "normal",
            textDecoration: underline ? "underline" : "none",
            textAlign: align,
            fontFamily: getFontFamilyCss(fontFamily),
            letterSpacing: getLetterSpacingCss(letterSpacing),
            textTransform: textTransform as any,
            color: color || undefined,
            width: "100%",
            padding: `${paddingV}px ${paddingH}px`,
          }}
          className="break-words select-text"
        >
          {content ? (
            <div>
              <div className="leading-tight">{String(content)}</div>
              {subtitle && (
                <div
                  className="text-xs text-muted-foreground mt-1 font-normal tracking-normal normal-case"
                  style={{ textTransform: "none", letterSpacing: "normal" }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          ) : (
            <span
              className="text-muted-foreground/40 text-xs italic"
            >
              Escribe un texto aquí...
            </span>
          )}
        </div>
      </div>
    );
  }

  if ((visualType as string) === "divider") {
    const thickness = Number((config as Record<string, unknown>).thickness ?? 1);
    const lineStyle = String((config as Record<string, unknown>).lineStyle ?? "solid");
    const color = String((config as Record<string, unknown>).color ?? "#cbd5e1");

    return (
      <div onClick={onSelect} className="w-full h-full flex items-center px-2 py-1 bg-transparent border-none shadow-none">
        <div
          className="w-full"
          style={{
            borderTopWidth: `${thickness}px`,
            borderTopStyle: lineStyle as any,
            borderTopColor: color,
          }}
        />
      </div>
    );
  }

  if ((visualType as string) === "image") {
    const rawContent = (config as Record<string, unknown>).content || "";
    const resolvedSrc = resolveDashboardImageUrl(String(rawContent));
    const objectFit = ((config as Record<string, unknown>).objectFit || "contain") as "contain" | "cover";
    const borderRadius = Number((config as Record<string, unknown>).borderRadius ?? 8);

    return (
      <div onClick={onSelect} className="w-full h-full p-1 flex items-center justify-center overflow-hidden bg-transparent border-none shadow-none">
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt="Imagen"
            style={{
              objectFit,
              borderRadius: `${borderRadius}px`,
            }}
            className="w-full h-full pointer-events-none rounded-md"
          />
        ) : (
          <div className="text-xs text-muted-foreground/40 border border-dashed border-border/60 rounded p-4">Sin imagen seleccionada</div>
        )}
      </div>
    );
  }

  const isUnconfigured = !config.data.dataset;
  const registryEntry = getVisualRegistryEntry(visualType);

  const handleCrossFilter = (field: string, rawVal: unknown, displayVal?: string) => {
    const datasetId = config.data.dataset;
    if (!datasetId) return;

    const dsMeta = catalog.find((ds) => ds.id === datasetId);
    const fieldMeta = dsMeta?.fields.find((f) => f.id === field);

    // 2. Solo se puede filtrar si es filtrable
    if (fieldMeta && fieldMeta.filterable === false) {
      return;
    }

    let finalValue: string | number | boolean | (string | number)[] =
      rawVal as string | number | boolean | (string | number)[];
    let finalGranularity: string | undefined = undefined;

    // 4. Campos de fecha
    if (fieldMeta?.dataType === "date") {
      const gran = config.data.granularity || "month";
      if (gran === "hour" || gran === "hourOfDay" || gran === "weekday") {
        return;
      }
      const range = resolveCrossFilterDateRange(rawVal, gran);
      if (!range) return;
      finalValue = range;
      finalGranularity = gran;
    }

    const display = displayVal || String(rawVal);
    const sourceWidgetId = widgetId || "";

    // Toggle
    if (
      crossFilters &&
      crossFilters.datasetId === datasetId &&
      crossFilters.field === field &&
      JSON.stringify(crossFilters.value) === JSON.stringify(finalValue)
    ) {
      clearCrossFilters();
      return;
    }

    setCrossFilter({
      datasetId,
      field,
      granularity: finalGranularity,
      value: finalValue,
      display,
      sourceWidgetId,
    });
  };

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

        {/* Indicador: filtro cruzado aplicado */}
        {hasCrossFilterApplied && (
          <span
            className="shrink-0"
            title="Este gráfico está filtrado por una selección activa"
          >
            <Filter className="size-3.5 text-primary" />
          </span>
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
            onCrossFilter={isShare ? undefined : handleCrossFilter}
          />
        )}
      </div>
    </div>
  );
}
