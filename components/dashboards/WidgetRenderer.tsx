"use client";

import React, { useMemo } from "react";
import { Image as ImageIcon } from "lucide-react";
import { DynamicVisual } from "./visuals/DynamicVisual";
import { adaptLegacyWidget } from "@/lib/dashboards/legacy-adapter";
import type { WidgetConfig } from "@/lib/dashboards/widget-schema";
import { cn } from "@/lib/utils";
import { resolveDashboardImageUrl } from "@/lib/dashboards/image-utils";

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
    const fontSizeNum =
      typeof rawFontSize === "number"
        ? rawFontSize
        : typeof rawFontSize === "string"
          ? parseInt(rawFontSize, 10) || 14
          : 14;
    const bold = Boolean((validConfig as Record<string, unknown>).bold ?? rawConfig.bold);
    const italic = Boolean((validConfig as Record<string, unknown>).italic ?? rawConfig.italic);
    const underline = Boolean((validConfig as Record<string, unknown>).underline ?? rawConfig.underline);
    const align = ((validConfig as Record<string, unknown>).align ?? rawConfig.align ?? "left") as "left" | "center" | "right";
    const fontFamily = String((validConfig as Record<string, unknown>).fontFamily ?? rawConfig.fontFamily ?? "Inter");
    const color = String((validConfig as Record<string, unknown>).color ?? rawConfig.color ?? "");
    const subtitle = String((validConfig as Record<string, unknown>).subtitle ?? rawConfig.subtitle ?? "");
    const letterSpacing = String((validConfig as Record<string, unknown>).letterSpacing ?? rawConfig.letterSpacing ?? "normal");
    const textTransform = String((validConfig as Record<string, unknown>).textTransform ?? rawConfig.textTransform ?? "none");
    const backgroundVariant = String((validConfig as Record<string, unknown>).backgroundVariant ?? rawConfig.backgroundVariant ?? "transparent");
    const verticalAlign = String((validConfig as Record<string, unknown>).verticalAlign ?? rawConfig.verticalAlign ?? "center");

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

    // Line-height adaptativo: fuentes grandes necesitan menos interlineado
    const lineHeight = fontSizeNum >= 32 ? 1.15 : fontSizeNum >= 20 ? 1.3 : 1.5;
    // Padding compacto y refinado
    const paddingV = Math.max(4, Math.round(fontSizeNum * 0.2));
    const paddingH = Math.max(8, Math.round(fontSizeNum * 0.3));

    return (
      <div
        data-widget-type="text"
        onClick={onSelect}
        className={cn(
          "w-full h-full flex overflow-hidden cursor-default select-text transition-all",
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

  // 2. Widget de Línea / Separador
  if (widgetType === "divider") {
    const rawConfig = (widget.config as Record<string, unknown> | undefined) || {};
    const thickness = Number((validConfig as Record<string, unknown>).thickness ?? rawConfig.thickness ?? 1);
    const lineStyle = String((validConfig as Record<string, unknown>).lineStyle ?? rawConfig.lineStyle ?? "solid");
    const color = String((validConfig as Record<string, unknown>).color ?? rawConfig.color ?? "#cbd5e1");

    return (
      <div
        data-widget-type="divider"
        onClick={onSelect}
        className={cn(
          "w-full h-full flex items-center px-2 py-1 bg-transparent border-none shadow-none",
          isSelected && isEditMode && "ring-2 ring-primary/40 rounded-sm"
        )}
      >
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

  // 3. Widget de Imagen
  if (widgetType === "image") {
    const rawConfig = (widget.config as Record<string, unknown> | undefined) || {};
    const rawContent =
      (validConfig as Record<string, unknown>).content ?? rawConfig.content ?? "";
    const resolvedSrc = resolveDashboardImageUrl(String(rawContent));
    const objectFit = ((validConfig as Record<string, unknown>).objectFit ?? rawConfig.objectFit ?? "contain") as "contain" | "cover";
    const borderRadius = Number((validConfig as Record<string, unknown>).borderRadius ?? rawConfig.borderRadius ?? 8);

    return (
      <div
        data-widget-type="image"
        onClick={onSelect}
        className={cn(
          "w-full h-full p-1 flex items-center justify-center overflow-hidden bg-transparent border-none shadow-none transition-colors",
          isSelected && isEditMode && "ring-2 ring-primary/40 rounded-lg"
        )}
      >
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={widget.title || "Imagen"}
            style={{
              objectFit,
              borderRadius: `${borderRadius}px`,
            }}
            className="w-full h-full pointer-events-none select-none transition-all"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/40 p-4 border border-dashed border-border/60 rounded-lg w-full h-full select-none">
            <ImageIcon className="size-8 mb-1.5 opacity-40" />
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
