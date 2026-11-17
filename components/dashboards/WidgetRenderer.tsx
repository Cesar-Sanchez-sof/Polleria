"use client";

import React, { useMemo } from "react";
import { Image as ImageIcon } from "lucide-react";
import { DynamicVisual } from "./visuals/DynamicVisual";
import { adaptLegacyWidget } from "@/lib/dashboards/legacy-adapter";
import type { WidgetConfig } from "@/lib/dashboards/widget-schema";
import { cn } from "@/lib/utils";

export interface WidgetData {
  id: string;
  title: string;
  type: string;
  metricKey?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: unknown;
}

interface WidgetRendererProps {
  widget: WidgetData;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditMode?: boolean;
  isShareMode?: boolean;
}

export function WidgetRenderer({
  widget,
  isSelected,
  onSelect,
  isEditMode,
  isShareMode,
}: WidgetRendererProps) {
  // Convierte widgets antiguos o incompletos en un WidgetConfig válido estilo Power BI
  const validConfig: WidgetConfig = useMemo(() => {
    return adaptLegacyWidget(widget);
  }, [widget]);

  const widgetType = widget.type || (validConfig as Record<string, unknown>).visualType;

  // 1. Widget de Texto
  if (widgetType === "text") {
    const rawConfig = (widget.config as Record<string, unknown> | undefined) || {};
    const content =
      (validConfig as Record<string, unknown>).content ?? rawConfig.content ?? "";
    const rawFontSize =
      (validConfig as Record<string, unknown>).fontSize ?? rawConfig.fontSize;
    const fontSize =
      typeof rawFontSize === "number"
        ? `${rawFontSize}px`
        : typeof rawFontSize === "string"
          ? rawFontSize
          : "14px";

    return (
      <div
        data-widget-type="text"
        onClick={onSelect}
        className={cn(
          "w-full h-full p-4 flex flex-col justify-start overflow-auto select-text bg-card text-card-foreground rounded-lg transition-colors",
          isSelected && isEditMode && "ring-2 ring-primary ring-offset-1"
        )}
      >
        {content ? (
          <div
            style={{ fontSize }}
            className="whitespace-pre-wrap break-words text-foreground font-normal leading-relaxed"
          >
            {String(content)}
          </div>
        ) : (
          <div className="text-muted-foreground/50 italic text-sm select-none">
            Escribe un texto aquí...
          </div>
        )}
      </div>
    );
  }

  // 2. Widget de Línea / Separador
  if (widgetType === "divider") {
    return (
      <div
        data-widget-type="divider"
        onClick={onSelect}
        className={cn(
          "w-full h-full flex items-center px-2 py-1 bg-transparent",
          isSelected && isEditMode && "ring-2 ring-primary ring-offset-1 rounded-sm"
        )}
      >
        <div className="w-full border-t border-border/80" />
      </div>
    );
  }

  // 3. Widget de Imagen
  if (widgetType === "image") {
    const rawConfig = (widget.config as Record<string, unknown> | undefined) || {};
    const content =
      (validConfig as Record<string, unknown>).content ?? rawConfig.content ?? "";

    return (
      <div
        data-widget-type="image"
        onClick={onSelect}
        className={cn(
          "w-full h-full p-2 flex items-center justify-center overflow-hidden bg-card rounded-lg transition-colors",
          isSelected && isEditMode && "ring-2 ring-primary ring-offset-1"
        )}
      >
        {content ? (
          <img
            src={String(content)}
            alt={widget.title || "Imagen"}
            className="max-w-full max-h-full object-contain pointer-events-none select-none rounded-md"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-4 border border-dashed border-border/80 rounded-lg w-full h-full select-none">
            <ImageIcon className="size-8 mb-1.5 opacity-50" />
            <span className="text-xs">Sin imagen seleccionada</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <DynamicVisual
      config={validConfig}
      widgetId={widget.id}
      isSelected={isSelected}
      onSelect={onSelect}
      isEditMode={isEditMode}
      isShareMode={isShareMode}
    />
  );
}
