"use client";

import React, { useState } from "react";
import { Sliders } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { useDashboardCatalog, type CatalogField } from "@/lib/hooks/use-visual-data";
import { VisualTab } from "./VisualTab";
import { FormatTab } from "./FormatTab";

export function PropertiesPanel() {
  const { widgets, selectedWidgetId, changeWidgetDataset } = useDashboardEditorStore();
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
            {config.visualType}
          </Badge>
        </div>

        {/* Origen de Datos (Selector de Dataset) */}
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
          <VisualTab
            widgetId={widgetId}
            dimensions={dimensions}
            measures={measures}
            currentFields={currentFields}
            isTransactional={isTransactional}
            defaultDateField={defaultDateField}
            currentDatasetLabel={currentDataset?.label}
          />
        </TabsContent>

        {/* TAB 2: FORMATO */}
        <TabsContent value="format" className="flex-1 overflow-hidden p-0 m-0 flex flex-col">
          <FormatTab widgetId={widgetId} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
