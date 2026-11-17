"use client";

import React, { useState, useRef } from "react";
import {
  Sliders,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { useDashboardCatalog, type CatalogField } from "@/lib/hooks/use-visual-data";
import { uploadDashboardImageAction } from "@/app/dashboards/config/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveDashboardImageUrl } from "@/lib/dashboards/image-utils";
import { VisualTab } from "./VisualTab";
import { FormatTab } from "./FormatTab";

export function PropertiesPanel() {
  const { widgets, selectedWidgetId, changeWidgetDataset, updateWidgetConfig } = useDashboardEditorStore();
  const { catalog, isLoading: isCatalogLoading } = useDashboardCatalog();
  const [activeTab, setActiveTab] = useState<"visual" | "format">("visual");

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);

  // ESTADO 1: Sin selección en el lienzo
  if (!selectedWidget) {
    return (
      <aside className="w-88 border-l border-border bg-card/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center shrink-0 select-none">
        <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-3">
          <Sliders className="size-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Selecciona un visual
        </h3>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Haz clic en cualquier tarjeta del lienzo para configurar sus datos, tipo de gráfico y diseño.
        </p>
      </aside>
    );
  }

  const { config, id: widgetId } = selectedWidget;
  const isStaticWidget =
    selectedWidget.type === "text" ||
    selectedWidget.type === "divider" ||
    selectedWidget.type === "image";
  const dataConfig = config.data;
  const currentDatasetId = dataConfig.dataset;

  const datasets = catalog || [];
  const currentDataset = datasets.find((d) => d.id === currentDatasetId);
  const isTransactional = Boolean(currentDataset?.isTransactional);
  const defaultDateField = currentDataset?.defaultDateField;

  // Filtrar dimensiones y medidas del dataset actual
  const currentFields: CatalogField[] = (currentDataset?.fields || []).filter(
    (f: CatalogField) => !("hidden" in f && Boolean((f as Record<string, unknown>).hidden))
  );
  const dimensions = currentFields.filter((f: CatalogField) => f.kind === "dimension");
  const measures = currentFields.filter((f: CatalogField) => f.kind === "measure" || f.dataType === "number");

  // Handler cambio de dataset con confirmación si hay campos asignados
  const handleDatasetChange = (newDatasetId: string) => {
    if (newDatasetId === currentDatasetId) return;

    const hasAssignedFields =
      Boolean(dataConfig.axis) ||
      Boolean(dataConfig.legend) ||
      (dataConfig.values && dataConfig.values.length > 0);

    if (hasAssignedFields) {
      const confirmed = window.confirm(
        "Cambiar el origen de datos limpiará los campos asignados en este visual. ¿Deseas continuar?"
      );
      if (!confirmed) return;
    }

    const nextDataset = datasets.find((d) => d.id === newDatasetId);
    changeWidgetDataset(widgetId, newDatasetId, {
      defaultDateField: nextDataset?.defaultDateField,
      isTransactional: nextDataset?.isTransactional,
    });
  };

  return (
    <aside className="w-88 border-l border-border bg-card flex flex-col shrink-0 select-none overflow-hidden h-full z-10">
      {/* 1. Cabecera fija del panel */}
      <div className="p-3.5 border-b border-border/80 flex flex-col gap-2.5 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-primary" />
            <h3 className="text-xs font-bold tracking-tight text-foreground uppercase">
              Panel de Propiedades
            </h3>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
            {selectedWidget.type || config.visualType}
          </Badge>
        </div>

        {/* Origen de Datos (Selector de Dataset) - solo para widgets de datos */}
        {!isStaticWidget && (
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Origen de datos</span>
              {isTransactional && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-300">
                  Transaccional
                </Badge>
              )}
            </Label>
            <select
              value={currentDatasetId || ""}
              onChange={(e) => handleDatasetChange(e.target.value)}
              disabled={isCatalogLoading}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="" disabled>
                {isCatalogLoading ? "Cargando catálogo..." : "Selecciona un dataset..."}
              </option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Pestañas de Navegación: Visual y Formato (El árbol de campos se ubica en Visual debajo de los pozos) */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "visual" | "format")}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 pt-2 pb-1 border-b border-border/60">
          <TabsList className="grid grid-cols-2 h-8 w-full p-0.5">
            <TabsTrigger value="visual" className="text-xs font-medium h-7 cursor-pointer">
              Visual
            </TabsTrigger>
            <TabsTrigger value="format" className="text-xs font-medium h-7 cursor-pointer">
              Formato
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: VISUAL, POZOS Y ÁRBOL DE CAMPOS */}
        <TabsContent value="visual" className="flex-1 overflow-hidden p-0 m-0 flex flex-col">
          {isStaticWidget ? (
            <StaticWidgetEditor
              widgetId={widgetId}
              widgetType={selectedWidget.type || String(config.visualType)}
              config={config as unknown as Record<string, unknown>}
            />
          ) : (
            <VisualTab
              widgetId={widgetId}
              dimensions={dimensions}
              measures={measures}
              currentFields={currentFields}
              isTransactional={isTransactional}
              defaultDateField={defaultDateField}
              currentDatasetLabel={currentDataset?.label}
            />
          )}
        </TabsContent>

        {/* TAB 2: FORMATO */}
        <TabsContent value="format" className="flex-1 overflow-hidden p-0 m-0 flex flex-col">
          <FormatTab widgetId={widgetId} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ─── Editor inline para widgets estáticos ────────────────────────────────────
function StaticWidgetEditor({
  widgetId,
  widgetType,
  config,
}: {
  widgetId: string;
  widgetType: string;
  config: Record<string, unknown>;
}) {
  const { updateWidgetConfig } = useDashboardEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. Text widget configuration
  if (widgetType === "text") {
    const content = typeof config.content === "string" ? config.content : "";
    const subtitle = typeof config.subtitle === "string" ? config.subtitle : "";
    const bold = Boolean(config.bold);
    const italic = Boolean(config.italic);
    const underline = Boolean(config.underline);
    const align = (typeof config.align === "string" ? config.align : "left") as "left" | "center" | "right";
    const verticalAlign = (typeof config.verticalAlign === "string" ? config.verticalAlign : "center") as "top" | "center" | "bottom";
    const fontFamily = typeof config.fontFamily === "string" ? config.fontFamily : "Inter";
    const fontSize = typeof config.fontSize === "number" ? config.fontSize : 16;
    const color = typeof config.color === "string" ? config.color : "#0f172a";
    const letterSpacing = typeof config.letterSpacing === "string" ? config.letterSpacing : "normal";
    const textTransform = typeof config.textTransform === "string" ? config.textTransform : "none";
    const backgroundVariant = typeof config.backgroundVariant === "string" ? config.backgroundVariant : "transparent";

    return (
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Contenido Principal */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Texto Principal
          </Label>
          <textarea
            value={content}
            onChange={(e) => updateWidgetConfig(widgetId, { content: e.target.value } as never)}
            placeholder="Escribe tu texto o título aquí..."
            rows={3}
            className="w-full text-xs rounded-md border border-input bg-background p-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y leading-relaxed font-medium"
          />
        </div>

        {/* Subtítulo opcional */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Subtítulo (Opcional)
          </Label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => updateWidgetConfig(widgetId, { subtitle: e.target.value } as never)}
            placeholder="Ej. Resumen del mes actual"
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Estilo de Fondo / Contenedor */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Fondo del Banner
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: "transparent", label: "Limpio (Sin fondo)" },
              { id: "card", label: "Tarjeta Blanca" },
              { id: "accent", label: "Resaltado Suave" },
              { id: "gradient", label: "Gradiente Banner" },
            ].map((bv) => (
              <Button
                key={bv.id}
                type="button"
                variant={backgroundVariant === bv.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { backgroundVariant: bv.id } as never)}
                className={cn(
                  "h-7 text-[11px] px-2 cursor-pointer truncate",
                  backgroundVariant === bv.id && "bg-primary/15 text-primary border-primary/40 font-semibold"
                )}
              >
                {bv.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Formato: Negrita, Cursiva, Subrayado, Mayúsculas */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estilo de texto
          </Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={bold ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateWidgetConfig(widgetId, { bold: !bold } as never)}
              className={cn("h-8 w-9 p-0 cursor-pointer", bold && "font-bold bg-primary/15 text-primary border-primary/40")}
              title="Negrita"
            >
              <Bold className="size-4" />
            </Button>
            <Button
              type="button"
              variant={italic ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateWidgetConfig(widgetId, { italic: !italic } as never)}
              className={cn("h-8 w-9 p-0 cursor-pointer", italic && "italic bg-primary/15 text-primary border-primary/40")}
              title="Cursiva"
            >
              <Italic className="size-4" />
            </Button>
            <Button
              type="button"
              variant={underline ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateWidgetConfig(widgetId, { underline: !underline } as never)}
              className={cn("h-8 w-9 p-0 cursor-pointer", underline && "underline bg-primary/15 text-primary border-primary/40")}
              title="Subrayado"
            >
              <Underline className="size-4" />
            </Button>
            <Button
              type="button"
              variant={textTransform === "uppercase" ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateWidgetConfig(widgetId, { textTransform: textTransform === "uppercase" ? "none" : "uppercase" } as never)}
              className={cn("h-8 px-2 text-[11px] font-bold cursor-pointer", textTransform === "uppercase" && "bg-primary/15 text-primary border-primary/40")}
              title="MAYÚSCULAS"
            >
              AA
            </Button>
          </div>
        </div>

        {/* Espaciado de letras (Tracking) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Espaciado de letras (Tracking)
          </Label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: "normal", label: "Normal" },
              { id: "wide", label: "Medio" },
              { id: "wider", label: "Elegante" },
              { id: "widest", label: "Amplio" },
            ].map((ls) => (
              <Button
                key={ls.id}
                type="button"
                variant={letterSpacing === ls.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { letterSpacing: ls.id } as never)}
                className={cn(
                  "h-7 text-[10px] p-0 cursor-pointer",
                  letterSpacing === ls.id && "bg-primary/15 text-primary border-primary/40 font-semibold"
                )}
              >
                {ls.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Alineación Horizontal y Vertical */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Alineación H.
            </Label>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant={align === "left" ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { align: "left" } as never)}
                className={cn("h-8 flex-1 p-0 text-xs cursor-pointer", align === "left" && "bg-primary/15 text-primary border-primary/40")}
                title="Alinear a la izquierda"
              >
                <AlignLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant={align === "center" ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { align: "center" } as never)}
                className={cn("h-8 flex-1 p-0 text-xs cursor-pointer", align === "center" && "bg-primary/15 text-primary border-primary/40")}
                title="Centrar horizontalmente"
              >
                <AlignCenter className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant={align === "right" ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { align: "right" } as never)}
                className={cn("h-8 flex-1 p-0 text-xs cursor-pointer", align === "right" && "bg-primary/15 text-primary border-primary/40")}
                title="Alinear a la derecha"
              >
                <AlignRight className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Alineación V.
            </Label>
            <div className="grid grid-cols-3 gap-0.5">
              {[
                { id: "top", label: "Arr." },
                { id: "center", label: "Med." },
                { id: "bottom", label: "Abj." },
              ].map((va) => (
                <Button
                  key={va.id}
                  type="button"
                  variant={verticalAlign === va.id ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => updateWidgetConfig(widgetId, { verticalAlign: va.id } as never)}
                  className={cn(
                    "h-8 text-[10px] p-0 cursor-pointer",
                    verticalAlign === va.id && "bg-primary/15 text-primary border-primary/40 font-semibold"
                  )}
                >
                  {va.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Tipografía */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Fuente
          </Label>
          <select
            value={fontFamily}
            onChange={(e) => updateWidgetConfig(widgetId, { fontFamily: e.target.value } as never)}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="Inter">Inter (Sans-serif moderna)</option>
            <option value="Roboto">Roboto (Limpia)</option>
            <option value="Arial">Arial (Estándar)</option>
            <option value="Serif">Serif Clásica (Elegante)</option>
            <option value="Playfair">Playfair Display (Titular Premium)</option>
            <option value="Montserrat">Montserrat (Geométrica)</option>
          </select>
        </div>

        {/* Tamaño y Color */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tamaño: {fontSize}px
            </Label>
            <input
              type="range"
              min={12}
              max={64}
              step={1}
              value={fontSize}
              onChange={(e) => updateWidgetConfig(widgetId, { fontSize: parseInt(e.target.value, 10) } as never)}
              className="w-full accent-primary h-6"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>12px</span>
              <span>64px</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Color
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color || "#0f172a"}
                onChange={(e) => updateWidgetConfig(widgetId, { color: e.target.value } as never)}
                className="size-8 rounded border border-border cursor-pointer p-0.5 bg-background"
              />
              <span className="text-xs font-mono text-muted-foreground">{color || "#0f172a"}</span>
            </div>
            {/* Paleta rápida */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {[
                { hex: "#0f172a", label: "Negro" },
                { hex: "#d97706", label: "Dorado" },
                { hex: "#2563eb", label: "Azul" },
                { hex: "#059669", label: "Verde" },
                { hex: "#dc2626", label: "Rojo" },
                { hex: "#64748b", label: "Gris" },
              ].map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.label}
                  onClick={() => updateWidgetConfig(widgetId, { color: sw.hex } as never)}
                  style={{ backgroundColor: sw.hex }}
                  className={cn(
                    "size-4 rounded-full border border-border cursor-pointer transition-transform hover:scale-125",
                    color.toLowerCase() === sw.hex.toLowerCase() && "ring-2 ring-primary ring-offset-1"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Divider widget configuration
  if (widgetType === "divider") {
    const thickness = typeof config.thickness === "number" ? config.thickness : 1;
    const lineStyle = typeof config.lineStyle === "string" ? config.lineStyle : "solid";
    const color = typeof config.color === "string" ? config.color : "#cbd5e1";

    return (
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Personaliza el aspecto del separador visual para estructurar secciones en el tablero.
        </p>

        {/* Grosor */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Grosor de línea
          </Label>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 4, 8].map((px) => (
              <Button
                key={px}
                type="button"
                variant={thickness === px ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { thickness: px } as never)}
                className={cn("h-8 text-xs cursor-pointer", thickness === px && "bg-primary/15 text-primary border-primary/40 font-semibold")}
              >
                {px}px
              </Button>
            ))}
          </div>
        </div>

        {/* Estilo de línea */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estilo de línea
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "solid", label: "Sólida" },
              { id: "dotted", label: "Punteada" },
              { id: "dashed", label: "Discontinua" },
            ].map((st) => (
              <Button
                key={st.id}
                type="button"
                variant={lineStyle === st.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { lineStyle: st.id } as never)}
                className={cn("h-8 text-xs cursor-pointer", lineStyle === st.id && "bg-primary/15 text-primary border-primary/40 font-semibold")}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Color de línea */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Color
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => updateWidgetConfig(widgetId, { color: e.target.value } as never)}
              className="size-8 rounded border border-border cursor-pointer p-0.5 bg-background"
            />
            <span className="text-xs font-mono text-muted-foreground">{color}</span>
          </div>
        </div>

        {/* Vista previa en miniatura */}
        <div className="mt-2 p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase">Vista previa</span>
          <div
            className="w-full my-2"
            style={{
              borderTopWidth: `${thickness}px`,
              borderTopStyle: lineStyle as any,
              borderTopColor: color,
            }}
          />
        </div>
      </div>
    );
  }

  // 3. Image widget configuration
  if (widgetType === "image") {
    const content = typeof config.content === "string" ? config.content : "";
    const resolvedPreviewSrc = resolveDashboardImageUrl(content);
    const objectFit = (typeof config.objectFit === "string" ? config.objectFit : "contain") as "contain" | "cover";
    const borderRadius = typeof config.borderRadius === "number" ? config.borderRadius : 8;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await uploadDashboardImageAction(formData);
        if (res.success && res.url) {
          updateWidgetConfig(widgetId, { content: res.url } as never);
          toast.success("Imagen subida a S3 exitosamente");
        } else {
          toast.error(res.error || "Error al subir la imagen");
        }
      } catch (err: any) {
        toast.error(err.message || "Error al conectar con S3");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    return (
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Botón de subida a S3 */}
        <div className="flex flex-col gap-2">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Subir archivo local a S3
          </Label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-9 gap-2 text-xs font-medium cursor-pointer shadow-xs border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Upload className="size-4 text-primary" />
            )}
            <span>{isUploading ? "Subiendo a S3..." : "Subir imagen"}</span>
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Sube PNG, JPG, WebP o SVG directo al bucket S3.
          </p>
        </div>

        {/* Vista previa de imagen */}
        {resolvedPreviewSrc ? (
          <div className="rounded-lg border border-border/80 p-2 bg-muted/20 flex flex-col items-center gap-2">
            <img
              src={resolvedPreviewSrc}
              alt="Vista previa"
              style={{
                objectFit,
                borderRadius: `${borderRadius}px`,
              }}
              className="max-h-36 max-w-full object-contain mx-auto block shadow-xs"
            />
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={content}>
              {content}
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 p-6 flex flex-col items-center justify-center text-center bg-muted/10">
            <ImageIcon className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Ninguna imagen seleccionada</p>
          </div>
        )}

        {/* Ajuste de imagen: Contain vs Cover */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Ajuste de imagen (Object-Fit)
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={objectFit === "contain" ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateWidgetConfig(widgetId, { objectFit: "contain" } as never)}
              className={cn("h-8 text-xs cursor-pointer", objectFit === "contain" && "bg-primary/15 text-primary border-primary/40 font-semibold")}
            >
              Contain (Completa)
            </Button>
            <Button
              type="button"
              variant={objectFit === "cover" ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateWidgetConfig(widgetId, { objectFit: "cover" } as never)}
              className={cn("h-8 text-xs cursor-pointer", objectFit === "cover" && "bg-primary/15 text-primary border-primary/40 font-semibold")}
            >
              Cover (Relleno)
            </Button>
          </div>
        </div>

        {/* Redondeo de bordes (Border Radius) hasta 100px */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Redondeo de bordes
            </Label>
            <span className="text-xs font-semibold text-primary">{borderRadius}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={2}
            value={borderRadius}
            onChange={(e) => updateWidgetConfig(widgetId, { borderRadius: parseInt(e.target.value, 10) } as never)}
            className="w-full accent-primary h-6"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0px (Recto)</span>
            <span>50px</span>
            <span>100px (Circular)</span>
          </div>
          {/* Botones de acceso rápido para redondeo */}
          <div className="grid grid-cols-4 gap-1 mt-1">
            {[
              { px: 0, label: "0px" },
              { px: 12, label: "12px" },
              { px: 32, label: "32px" },
              { px: 100, label: "100px" },
            ].map((preset) => (
              <Button
                key={preset.px}
                type="button"
                variant={borderRadius === preset.px ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateWidgetConfig(widgetId, { borderRadius: preset.px } as never)}
                className={cn(
                  "h-6 text-[10px] p-0 cursor-pointer",
                  borderRadius === preset.px && "bg-primary/15 text-primary border-primary/40 font-semibold"
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
