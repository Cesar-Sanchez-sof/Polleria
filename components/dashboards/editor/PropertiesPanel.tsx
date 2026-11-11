"use client";

import React, { useState } from "react";
import {
  BarChart3,
  AlignLeft,
  LineChart,
  AreaChart,
  PieChart,
  Disc,
  Hash,
  Table as TableIcon,
  Sliders,
  Database,
  Palette,
  Eye,
  Plus,
  X,
  Type,
  Calendar,
  Calculator,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { useDashboardCatalog, type CatalogField } from "@/lib/hooks/use-visual-data";
import {
  DEFAULT_PALETTES,
  type VisualType,
  type MeasureAggregation,
  type DatePreset,
  type DateGranularity,
} from "@/lib/dashboards/widget-schema";

const VISUAL_TYPES: { type: VisualType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "column", label: "Columna", icon: BarChart3 },
  { type: "bar", label: "Barra", icon: AlignLeft },
  { type: "line", label: "Línea", icon: LineChart },
  { type: "area", label: "Área", icon: AreaChart },
  { type: "pie", label: "Circular", icon: PieChart },
  { type: "donut", label: "Anillo", icon: Disc },
  { type: "card", label: "Tarjeta", icon: Hash },
  { type: "table", label: "Tabla", icon: TableIcon },
];

const DATE_PRESETS: { preset: DatePreset; label: string }[] = [
  { preset: "today", label: "Hoy" },
  { preset: "yesterday", label: "Ayer" },
  { preset: "last7", label: "Últimos 7 días" },
  { preset: "last30", label: "Últimos 30 días" },
  { preset: "thisMonth", label: "Este mes" },
  { preset: "lastMonth", label: "Mes pasado" },
  { preset: "thisYear", label: "Este año" },
  { preset: "custom", label: "Rango personalizado" },
];

export function PropertiesPanel() {
  const {
    widgets,
    selectedWidgetId,
    changeWidgetDataset,
    updateWidgetVisualType,
    assignFieldToWell,
    removeFieldFromWell,
    updateMeasureAggregation,
    updateWidgetDateRange,
    updateWidgetSort,
    updateWidgetLimit,
    updateWidgetGranularity,
    updateWidgetFormat,
    updateWidgetTitle,
  } = useDashboardEditorStore();

  const { catalog, isLoading: isCatalogLoading } = useDashboardCatalog();
  const [activeTab, setActiveTab] = useState<"visual" | "format" | "data">("visual");

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);

  // ESTADO 1: Sin selección en el lienzo
  if (!selectedWidget) {
    return (
      <aside className="w-84 border-l border-border bg-card/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center shrink-0 select-none">
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
  const formatConfig = config.format;
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

      {/* 2. Pestañas de Navegación: Visualizaciones, Formato, Datos */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "visual" | "format" | "data")}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 pt-2 pb-1 border-b border-border/60">
          <TabsList className="grid grid-cols-3 h-8 w-full p-0.5">
            <TabsTrigger value="visual" className="text-xs font-medium h-7 cursor-pointer">
              Visual
            </TabsTrigger>
            <TabsTrigger value="format" className="text-xs font-medium h-7 cursor-pointer">
              Formato
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs font-medium h-7 cursor-pointer">
              Datos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================================================================== */}
        {/* TAB 1: VISUALIZACIONES & POZOS                                    */}
        {/* ================================================================== */}
        <TabsContent value="visual" className="flex-1 overflow-y-auto p-3.5 space-y-4 pb-24 m-0">
          {/* Cuadrícula de Tipos de Visualización */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tipo de Visualización
            </Label>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-lg border border-border/70 bg-muted/20">
              {VISUAL_TYPES.map((vt) => {
                const Icon = vt.icon;
                const isActive = config.visualType === vt.type;
                return (
                  <button
                    key={vt.type}
                    type="button"
                    onClick={() => updateWidgetVisualType(widgetId, vt.type)}
                    title={vt.label}
                    className={`flex flex-col items-center justify-center p-2 rounded-md gap-1 transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="text-[9px] tracking-tight">{vt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuración de Pozos según VisualType */}
          <div className="space-y-3.5 pt-1">
            {/* POZO 1: EJE O CATEGORÍA (Excepto en card) */}
            {config.visualType !== "card" && (
              <WellSection
                title={config.visualType === "pie" || config.visualType === "donut" ? "Categoría" : "Eje (Dimensión)"}
                required={config.visualType !== "table"}
                currentValue={dataConfig.axis}
                availableFields={dimensions}
                onSelectField={(fId) => assignFieldToWell(widgetId, "axis", fId)}
                onRemoveField={() => removeFieldFromWell(widgetId, "axis")}
              >
                {/* Granularidad para campos de fecha en el eje */}
                {dataConfig.axis && (
                  <GranularitySelector
                    axisFieldId={dataConfig.axis}
                    currentGranularity={dataConfig.granularity}
                    datasetFields={currentFields}
                    onSelectGranularity={(g) => updateWidgetGranularity(widgetId, g)}
                  />
                )}
              </WellSection>
            )}

            {/* POZO 2: LEYENDA (Solo en column, bar, line, area, table) */}
            {["column", "bar", "line", "area", "table"].includes(config.visualType) && (
              <WellSection
                title="Leyenda (Desglose)"
                required={false}
                currentValue={dataConfig.legend}
                availableFields={dimensions.filter((d) => d.id !== dataConfig.axis)}
                onSelectField={(fId) => assignFieldToWell(widgetId, "legend", fId)}
                onRemoveField={() => removeFieldFromWell(widgetId, "legend")}
              />
            )}

            {/* POZO 3: VALORES / MEDIDAS */}
            <div className="space-y-1.5 p-2.5 rounded-lg border border-border/80 bg-muted/15">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>Valores (Medidas)</span>
                  <span className="text-destructive">*</span>
                </Label>
                <AddMeasurePopover
                  measures={measures}
                  onSelectMeasure={(fieldId) => assignFieldToWell(widgetId, "values", fieldId)}
                />
              </div>

              {/* Lista de medidas asignadas */}
              {dataConfig.values && dataConfig.values.length > 0 ? (
                <div className="space-y-1.5 mt-2">
                  {dataConfig.values.map((val, idx) => {
                    const catalogField = measures.find((m) => m.id === val.field);
                    const allowedAggs = catalogField?.allowedAggregations || ["sum", "avg", "count", "min", "max", "countDistinct"];
                    const isCalculated = Boolean(catalogField?.isCalculated);

                    return (
                      <div
                        key={`${val.field}-${idx}`}
                        className="flex items-center justify-between gap-1.5 p-1.5 bg-background border border-border/90 rounded-md text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Hash className="size-3 text-primary shrink-0" />
                          <span className="truncate font-medium text-[11px]" title={catalogField?.label || val.field}>
                            {catalogField?.label || val.field}
                          </span>
                        </div>

                        {/* Selector de agregación */}
                        <select
                          value={val.agg}
                          disabled={isCalculated}
                          onChange={(e) =>
                            updateMeasureAggregation(widgetId, idx, e.target.value as MeasureAggregation)
                          }
                          className="h-6 text-[10px] font-mono border border-input rounded bg-muted/30 px-1 text-foreground"
                          title={isCalculated ? "Medida calculada: agregación fija" : "Cambiar agregación"}
                        >
                          {allowedAggs.map((agg) => (
                            <option key={agg} value={agg}>
                              {agg}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeFieldFromWell(widgetId, "values", idx)}
                          className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/80 italic mt-1">
                  Sin medidas asignadas. Agrega al menos una.
                </p>
              )}
            </div>

            {/* POZO 4: FILTRO DE FECHAS RELATIVAS */}
            <DateRangeWellSection
              dateRange={dataConfig.dateRange}
              isTransactional={isTransactional}
              defaultDateField={defaultDateField}
              datasetFields={currentFields}
              onUpdateDateRange={(dr) => updateWidgetDateRange(widgetId, dr)}
            />

            {/* POZO 5: ORDEN Y TOP N */}
            <SortAndLimitSection
              sort={dataConfig.sort}
              limit={dataConfig.limit}
              axisField={dataConfig.axis}
              measures={dataConfig.values}
              onUpdateSort={(s) => updateWidgetSort(widgetId, s)}
              onUpdateLimit={(l) => updateWidgetLimit(widgetId, l)}
            />
          </div>
        </TabsContent>

        {/* ================================================================== */}
        {/* TAB 2: FORMATO & ESTILOS VISUALES                                 */}
        {/* ================================================================== */}
        <TabsContent value="format" className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-24 m-0">
          {(() => {
            const isCard = config.visualType === "card";
            const isTable = config.visualType === "table";
            const isPieOrDonut = config.visualType === "pie" || config.visualType === "donut";
            const showAxes = !isCard && !isTable && !isPieOrDonut; // solo column, bar, line, area
            const showLegend = !isCard && !isTable;
            const showDataLabels = !isCard && !isTable;
            const showNumberFormat = isCard;

            return (
              <Accordion multiple defaultValue={["title", "colors", "labels", "legend", "axes", "numberFormat"]} className="space-y-2">
                {/* SECCIÓN 1: TÍTULO */}
                <AccordionItem value="title" className="border border-border/80 rounded-lg bg-card/60 px-3">
                  <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                    Título
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Mostrar título</Label>
                      <Switch
                        checked={formatConfig.title.show}
                        onCheckedChange={(checked) =>
                          updateWidgetFormat(widgetId, {
                            title: { ...formatConfig.title, show: checked },
                          })
                        }
                      />
                    </div>

                    {formatConfig.title.show && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Texto del título</Label>
                          <Input
                            value={formatConfig.title.text}
                            onChange={(e) => updateWidgetTitle(widgetId, e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Tamaño fuente</Label>
                            <Input
                              type="number"
                              min={10}
                              max={28}
                              value={formatConfig.title.fontSize || 14}
                              onChange={(e) =>
                                updateWidgetFormat(widgetId, {
                                  title: { ...formatConfig.title, fontSize: Number(e.target.value) },
                                })
                              }
                              className="h-7 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Alineación</Label>
                            <select
                              value={formatConfig.title.align || "left"}
                              onChange={(e) =>
                                updateWidgetFormat(widgetId, {
                                  title: {
                                    ...formatConfig.title,
                                    align: e.target.value as "left" | "center" | "right",
                                  },
                                })
                              }
                              className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                            >
                              <option value="left">Izquierda</option>
                              <option value="center">Centro</option>
                              <option value="right">Derecha</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* SECCIÓN 2: COLORES & PALETAS */}
                <AccordionItem value="colors" className="border border-border/80 rounded-lg bg-card/60 px-3">
                  <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                    Colores
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Paleta temática</Label>
                      <select
                        value={formatConfig.colors.palette || "polleria"}
                        onChange={(e) => {
                          const palName = e.target.value;
                          const series = DEFAULT_PALETTES[palName] || DEFAULT_PALETTES.polleria;
                          updateWidgetFormat(widgetId, {
                            colors: {
                              ...formatConfig.colors,
                              palette: palName,
                              series,
                              custom: undefined,
                            },
                          });
                        }}
                        className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                      >
                        <option value="polleria">Pollería (Cálida y Fuego)</option>
                        <option value="modern">Moderno (Multicolor)</option>
                        <option value="warm">Cálido (Rojos y Ámbar)</option>
                        <option value="cool">Frío (Azules y Violetas)</option>
                      </select>
                    </div>

                    {/* Color personalizado con react-colorful */}
                    <ColorPickerPopover
                      currentColor={formatConfig.colors.custom?.[0] || formatConfig.colors.series[0] || "#ef4444"}
                      onColorChange={(newColor) =>
                        updateWidgetFormat(widgetId, {
                          colors: {
                            ...formatConfig.colors,
                            custom: [newColor],
                          },
                        })
                      }
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* SECCIÓN FORMATO NUMÉRICO (Solo para card) */}
                {showNumberFormat && (
                  <AccordionItem value="numberFormat" className="border border-border/80 rounded-lg bg-card/60 px-3">
                    <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                      Formato Numérico
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Prefijo de moneda / símbolo</Label>
                        <Input
                          placeholder="Ej. S/ "
                          value={formatConfig.numberFormat?.prefix ?? "S/ "}
                          onChange={(e) =>
                            updateWidgetFormat(widgetId, {
                              numberFormat: {
                                decimals: formatConfig.numberFormat?.decimals ?? 2,
                                prefix: e.target.value,
                                compact: formatConfig.numberFormat?.compact ?? false,
                              },
                            })
                          }
                          className="h-7 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Decimales (0 a 4)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={4}
                          value={formatConfig.numberFormat?.decimals ?? 2}
                          onChange={(e) =>
                            updateWidgetFormat(widgetId, {
                              numberFormat: {
                                decimals: Math.max(0, Math.min(4, Number(e.target.value) || 0)),
                                prefix: formatConfig.numberFormat?.prefix ?? "S/ ",
                                compact: formatConfig.numberFormat?.compact ?? false,
                              },
                            })
                          }
                          className="h-7 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-col">
                          <Label className="text-xs">Abreviar miles / millones</Label>
                          <span className="text-[10px] text-muted-foreground">Muestra 14.8K / 1.2M</span>
                        </div>
                        <Switch
                          checked={formatConfig.numberFormat?.compact ?? false}
                          onCheckedChange={(checked) =>
                            updateWidgetFormat(widgetId, {
                              numberFormat: {
                                decimals: formatConfig.numberFormat?.decimals ?? 2,
                                prefix: formatConfig.numberFormat?.prefix ?? "S/ ",
                                compact: checked,
                              },
                            })
                          }
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* SECCIÓN 3: ETIQUETAS DE DATOS (Oculto en card y table) */}
                {showDataLabels && (
                  <AccordionItem value="labels" className="border border-border/80 rounded-lg bg-card/60 px-3">
                    <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                      Etiquetas de Datos
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Mostrar etiquetas</Label>
                        <Switch
                          checked={formatConfig.dataLabels?.show ?? false}
                          onCheckedChange={(checked) =>
                            updateWidgetFormat(widgetId, {
                              dataLabels: { ...formatConfig.dataLabels, show: checked },
                            })
                          }
                        />
                      </div>

                      {formatConfig.dataLabels?.show && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Posición</Label>
                            <select
                              value={formatConfig.dataLabels?.position || "top"}
                              onChange={(e) =>
                                updateWidgetFormat(widgetId, {
                                  dataLabels: { ...formatConfig.dataLabels, position: e.target.value },
                                })
                              }
                              className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                            >
                              <option value="top">Superior / Fuera</option>
                              <option value="inside">Dentro</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Tamaño</Label>
                            <Input
                              type="number"
                              min={9}
                              max={16}
                              value={formatConfig.dataLabels?.fontSize || 11}
                              onChange={(e) =>
                                updateWidgetFormat(widgetId, {
                                  dataLabels: { ...formatConfig.dataLabels, fontSize: Number(e.target.value) },
                                })
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* SECCIÓN 4: LEYENDA (Oculto en card y table) */}
                {showLegend && (
                  <AccordionItem value="legend" className="border border-border/80 rounded-lg bg-card/60 px-3">
                    <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                      Leyenda
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Mostrar leyenda</Label>
                        <Switch
                          checked={formatConfig.legend.show}
                          onCheckedChange={(checked) =>
                            updateWidgetFormat(widgetId, {
                              legend: { ...formatConfig.legend, show: checked },
                            })
                          }
                        />
                      </div>

                      {formatConfig.legend.show && (
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Posición de leyenda</Label>
                          <select
                            value={formatConfig.legend.position || "top"}
                            onChange={(e) =>
                              updateWidgetFormat(widgetId, {
                                legend: {
                                  ...formatConfig.legend,
                                  position: e.target.value as "top" | "bottom" | "left" | "right",
                                },
                              })
                            }
                            className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                          >
                            <option value="top">Arriba</option>
                            <option value="bottom">Abajo</option>
                            <option value="left">Izquierda</option>
                            <option value="right">Derecha</option>
                          </select>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* SECCIÓN 5: EJES & CUADRÍCULA (Solo para column, bar, line, area) */}
                {showAxes && (
                  <AccordionItem value="axes" className="border border-border/80 rounded-lg bg-card/60 px-3">
                    <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                      Ejes y Cuadrícula
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Título Eje X</Label>
                        <Input
                          placeholder="Ej. Mes / Plato / Categoría"
                          value={formatConfig.axes?.xTitle || ""}
                          onChange={(e) =>
                            updateWidgetFormat(widgetId, {
                              axes: { ...formatConfig.axes, xTitle: e.target.value, showGrid: formatConfig.axes?.showGrid ?? true },
                            })
                          }
                          className="h-7 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Título Eje Y</Label>
                        <Input
                          placeholder="Ej. Soles (S/) / Cantidad"
                          value={formatConfig.axes?.yTitle || ""}
                          onChange={(e) =>
                            updateWidgetFormat(widgetId, {
                              axes: { ...formatConfig.axes, yTitle: e.target.value, showGrid: formatConfig.axes?.showGrid ?? true },
                            })
                          }
                          className="h-7 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-xs">Mostrar cuadrícula</Label>
                        <Switch
                          checked={formatConfig.axes?.showGrid ?? true}
                          onCheckedChange={(checked) =>
                            updateWidgetFormat(widgetId, {
                              axes: { ...formatConfig.axes, showGrid: checked },
                            })
                          }
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* SECCIÓN 6: FONDO Y BORDE */}
                <AccordionItem value="border" className="border border-border/80 rounded-lg bg-card/60 px-3">
                  <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
                    Fondo y Borde
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Mostrar borde</Label>
                      <Switch
                        checked={formatConfig.border?.show ?? false}
                        onCheckedChange={(checked) =>
                          updateWidgetFormat(widgetId, {
                            border: {
                              ...formatConfig.border,
                              show: checked,
                              color: formatConfig.border?.color || "#e2e8f0",
                              radius: formatConfig.border?.radius ?? 12,
                              width: 1,
                            },
                          })
                        }
                      />
                    </div>

                    {formatConfig.border?.show && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Radio esquina</Label>
                          <Input
                            type="number"
                            min={0}
                            max={24}
                            value={formatConfig.border?.radius ?? 12}
                            onChange={(e) =>
                              updateWidgetFormat(widgetId, {
                                border: {
                                  ...formatConfig.border,
                                  show: true,
                                  radius: Number(e.target.value),
                                  color: formatConfig.border?.color || "#e2e8f0",
                                  width: 1,
                                },
                              })
                            }
                            className="h-7 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Color borde</Label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formatConfig.border?.color || "#e2e8f0"}
                              onChange={(e) =>
                                updateWidgetFormat(widgetId, {
                                  border: {
                                    ...formatConfig.border,
                                    show: true,
                                    color: e.target.value,
                                    radius: formatConfig.border?.radius ?? 12,
                                    width: 1,
                                  },
                                })
                              }
                              className="size-7 rounded border border-input cursor-pointer"
                            />
                            <span className="text-[10px] font-mono">{formatConfig.border?.color || "#e2e8f0"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })()}
        </TabsContent>

        {/* ================================================================== */}
        {/* TAB 3: CATÁLOGO DE DATOS (ÁRBOL DE CAMPOS)                         */}
        {/* ================================================================== */}
        <TabsContent value="data" className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-24 m-0">
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
                        className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 text-xs text-foreground group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon className={`size-3.5 ${isDate ? "text-amber-500" : "text-blue-500"} shrink-0`} />
                          <span className="truncate">{dim.label}</span>
                        </div>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => assignFieldToWell(widgetId, "axis", dim.id)}
                          title="Asignar al Eje"
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
                  <Hash className="size-3 text-emerald-500" />
                  <span>Medidas ({measures.length})</span>
                </Label>
                <div className="space-y-1 border border-border/70 rounded-md p-1.5 bg-muted/10">
                  {measures.map((m) => {
                    const isCalc = Boolean(m.isCalculated);
                    const Icon = isCalc ? Calculator : Hash;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 text-xs text-foreground group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon className={`size-3.5 ${isCalc ? "text-purple-500" : "text-emerald-500"} shrink-0`} />
                          <span className="truncate">{m.label}</span>
                          {isCalc && (
                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                              calc
                            </Badge>
                          )}
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
        </TabsContent>
      </Tabs>
    </aside>
  );
}

/**
 * Componente genérico para un pozo de dimensión simple (Eje o Leyenda)
 */
function WellSection({
  title,
  required,
  currentValue,
  availableFields,
  onSelectField,
  onRemoveField,
  children,
}: {
  title: string;
  required?: boolean;
  currentValue?: string;
  availableFields: CatalogField[];
  onSelectField: (fieldId: string) => void;
  onRemoveField: () => void;
  children?: React.ReactNode;
}) {
  const currentField = availableFields.find((f) => f.id === currentValue);

  return (
    <div className="space-y-1.5 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span>{title}</span>
          {required && <span className="text-destructive">*</span>}
        </Label>
        {!currentValue && (
          <AddFieldPopover
            fields={availableFields}
            onSelectField={onSelectField}
          />
        )}
      </div>

      {currentValue ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 p-1.5 bg-background border border-border/90 rounded-md text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Type className="size-3 text-blue-500 shrink-0" />
              <span className="truncate font-medium text-[11px]" title={currentField?.label || currentValue}>
                {currentField?.label || currentValue}
              </span>
            </div>
            <button
              type="button"
              onClick={onRemoveField}
              className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <X className="size-3" />
            </button>
          </div>
          {children}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/80 italic mt-1">
          {required ? "Campo requerido. Haz clic en '+' para asignar." : "Opcional. Haz clic en '+' para agregar."}
        </p>
      )}
    </div>
  );
}

/**
 * Selector de granularidad para campos de fecha en el eje
 */
function GranularitySelector({
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

/**
 * Pozo para Filtro de Fechas Relativas con Presets en America/Lima
 */
function DateRangeWellSection({
  dateRange,
  isTransactional,
  defaultDateField,
  datasetFields,
  onUpdateDateRange,
}: {
  dateRange?: { field: string; preset: DatePreset; from?: string; to?: string };
  isTransactional: boolean;
  defaultDateField?: string;
  datasetFields: CatalogField[];
  onUpdateDateRange: (dr?: { field: string; preset: DatePreset; from?: string; to?: string }) => void;
}) {
  const dateFields = datasetFields.filter((f) => f.dataType === "date" || Boolean(f.hasTime));
  const activeFieldId = dateRange?.field || defaultDateField || dateFields[0]?.id;
  const currentPreset = dateRange?.preset || (isTransactional ? "thisMonth" : "thisMonth");

  // Si no hay dateRange y no es transaccional, mostrar botón para habilitarlo
  if (!dateRange && !isTransactional) {
    return (
      <div className="p-2.5 rounded-lg border border-border/80 bg-muted/15 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-foreground">Filtro de Fechas</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (activeFieldId) {
              onUpdateDateRange({ field: activeFieldId, preset: "thisMonth" });
            }
          }}
          className="h-6 text-[10px] px-2 cursor-pointer"
        >
          <Plus className="size-3 mr-1" />
          <span>Activar</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Calendar className="size-3.5 text-amber-500" />
          <span>Filtro de Fechas</span>
          {isTransactional && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-300">
              Obligatorio
            </Badge>
          )}
        </Label>
        {!isTransactional && (
          <button
            type="button"
            onClick={() => onUpdateDateRange(undefined)}
            className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
          >
            Quitar
          </button>
        )}
      </div>

      {/* Select de Campo de Fecha */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Campo de fecha</Label>
        <select
          value={activeFieldId || ""}
          onChange={(e) =>
            onUpdateDateRange({
              field: e.target.value,
              preset: currentPreset,
              from: dateRange?.from,
              to: dateRange?.to,
            })
          }
          className="w-full h-7 text-xs rounded border border-input bg-background px-2 text-foreground"
        >
          {dateFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} {f.id === defaultDateField ? "(Por defecto)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Select de Preset */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Rango relativo (Lima UTC-5)</Label>
        <select
          value={currentPreset}
          onChange={(e) =>
            onUpdateDateRange({
              field: activeFieldId || "fecha",
              preset: e.target.value as DatePreset,
              from: dateRange?.from,
              to: dateRange?.to,
            })
          }
          className="w-full h-7 text-xs rounded border border-input bg-background px-2 text-foreground"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.preset} value={p.preset}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Inputs de fecha para rango personalizado */}
      {currentPreset === "custom" && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Desde</Label>
            <Input
              type="date"
              value={dateRange?.from || ""}
              onChange={(e) =>
                onUpdateDateRange({
                  field: activeFieldId || "fecha",
                  preset: "custom",
                  from: e.target.value,
                  to: dateRange?.to,
                })
              }
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              value={dateRange?.to || ""}
              onChange={(e) =>
                onUpdateDateRange({
                  field: activeFieldId || "fecha",
                  preset: "custom",
                  from: dateRange?.from,
                  to: e.target.value,
                })
              }
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sección Orden y Top N
 */
function SortAndLimitSection({
  sort,
  limit,
  axisField,
  measures,
  onUpdateSort,
  onUpdateLimit,
}: {
  sort?: { by: string; dir: "asc" | "desc" };
  limit?: number;
  axisField?: string;
  measures?: { field: string; agg: string }[];
  onUpdateSort: (s?: { by: string; dir: "asc" | "desc" }) => void;
  onUpdateLimit: (l?: number) => void;
}) {
  return (
    <div className="space-y-2.5 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <Label className="text-xs font-semibold text-foreground">
        Orden y Límite de Filas
      </Label>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Ordenar por</Label>
          <select
            value={sort?.by || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onUpdateSort(undefined);
              } else {
                onUpdateSort({ by: val, dir: sort?.dir || "desc" });
              }
            }}
            className="w-full h-7 text-xs rounded border border-input bg-background px-1.5 text-foreground"
          >
            <option value="">Por defecto</option>
            {axisField && <option value={axisField}>Eje ({axisField})</option>}
            {(measures || []).map((m) => (
              <option key={m.field} value={`${m.field}_${m.agg}`}>
                {m.field} ({m.agg})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Dirección</Label>
          <select
            value={sort?.dir || "desc"}
            disabled={!sort?.by}
            onChange={(e) => {
              if (sort?.by) {
                onUpdateSort({ by: sort.by, dir: e.target.value as "asc" | "desc" });
              }
            }}
            className="w-full h-7 text-xs rounded border border-input bg-background px-1.5 text-foreground disabled:opacity-50"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Mostrar primeros N (Top N)</Label>
        <Input
          type="number"
          min={1}
          max={1000}
          placeholder="200"
          value={limit ?? 200}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onUpdateLimit(isNaN(val) ? undefined : Math.min(1000, Math.max(1, val)));
          }}
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

/**
 * Popover para agregar campos al pozo
 */
function AddFieldPopover({
  fields,
  onSelectField,
}: {
  fields: CatalogField[];
  onSelectField: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="size-5 rounded border border-input bg-background hover:bg-muted inline-flex items-center justify-center cursor-pointer">
        <Plus className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5 max-h-60 overflow-y-auto">
        <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase">
          Seleccionar Campo
        </div>
        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">Sin campos disponibles</p>
        ) : (
          fields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onSelectField(f.id);
                setOpen(false);
              }}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/80 flex items-center justify-between cursor-pointer"
            >
              <span className="truncate">{f.label}</span>
              <span className="text-[9px] text-muted-foreground font-mono">{f.dataType}</span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Popover para agregar medidas al pozo de Valores
 */
function AddMeasurePopover({
  measures,
  onSelectMeasure,
}: {
  measures: CatalogField[];
  onSelectMeasure: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="size-5 rounded border border-input bg-background hover:bg-muted inline-flex items-center justify-center cursor-pointer">
        <Plus className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5 max-h-60 overflow-y-auto">
        <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase">
          Agregar Medida
        </div>
        {measures.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">Sin medidas disponibles</p>
        ) : (
          measures.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onSelectMeasure(m.id);
                setOpen(false);
              }}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/80 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Hash className="size-3 text-emerald-500 shrink-0" />
                <span className="truncate">{m.label}</span>
              </div>
              {m.isCalculated && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                  calc
                </Badge>
              )}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Popover con React Colorful para selección de color personalizada
 */
function ColorPickerPopover({
  currentColor,
  onColorChange,
}: {
  currentColor: string;
  onColorChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-[11px] text-muted-foreground">Color de serie principal</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex items-center gap-1.5 px-2 py-1 rounded border border-input bg-background hover:bg-muted/40 cursor-pointer">
          <div className="size-4 rounded-full border border-border" style={{ backgroundColor: currentColor }} />
          <span className="text-[10px] font-mono">{currentColor}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <HexColorPicker color={currentColor} onChange={onColorChange} />
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-7 text-xs font-mono"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
