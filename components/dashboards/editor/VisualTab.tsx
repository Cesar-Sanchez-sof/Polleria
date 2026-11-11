"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import {
  VISUAL_CATEGORIES,
  getVisualsByCategory,
  getVisualRegistryEntry,
} from "@/lib/dashboards/visual-registry";
import { WellSection } from "./wells/WellSection";
import { GranularitySelector } from "./wells/GranularitySelector";
import { MeasuresWellSection } from "./wells/MeasuresWellSection";
import { DateRangeWellSection } from "./wells/DateRangeWellSection";
import { SortAndLimitSection } from "./wells/SortAndLimitSection";
import { FieldsTreeSection } from "./FieldsTreeSection";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import type { CatalogField } from "@/lib/hooks/use-visual-data";
import type { MeasureAggregation, VisualType } from "@/lib/dashboards/widget-schema";

export function VisualTab({
  widgetId,
  dimensions,
  measures,
  currentFields,
  isTransactional,
  defaultDateField,
  currentDatasetLabel,
}: {
  widgetId: string;
  dimensions: CatalogField[];
  measures: CatalogField[];
  currentFields: CatalogField[];
  isTransactional: boolean;
  defaultDateField?: string;
  currentDatasetLabel?: string;
}) {
  const {
    widgets,
    updateWidgetVisualType,
    assignFieldToWell,
    removeFieldFromWell,
    updateMeasureAggregation,
    updateWidgetDateRange,
    updateWidgetSort,
    updateWidgetLimit,
    updateWidgetGranularity,
    updateWidgetData,
  } = useDashboardEditorStore();

  const selectedWidget = widgets.find((w) => w.id === widgetId);
  if (!selectedWidget) return null;

  const config = selectedWidget.config;
  const dataConfig = config.data;
  const registryEntry = getVisualRegistryEntry(config.visualType);
  const isCombo = config.visualType === "combo";

  const axisWell = registryEntry.wells.find((w) => w.role === "axis");
  const legendWell = registryEntry.wells.find((w) => w.role === "legend");
  const valuesWell = registryEntry.wells.find((w) => w.role === "values");
  const valuesColumnWell = registryEntry.wells.find((w) => w.role === "values_column");
  const valuesLineWell = registryEntry.wells.find((w) => w.role === "values_line");

  const handleToggleSeries = (index: number, series: "column" | "line") => {
    const updatedValues = [...dataConfig.values];
    if (updatedValues[index]) {
      updatedValues[index] = { ...updatedValues[index], series };
      updateWidgetData(widgetId, { values: updatedValues });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-4 pb-24 m-0">
      {/* 1. Selector de Tipos de Visualización agrupados por Categoría con Tooltip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Tipo de Visualización
          </Label>
          <span className="text-[10px] text-muted-foreground font-medium">
            {registryEntry.label}
          </span>
        </div>

        <div className="space-y-2.5">
          {VISUAL_CATEGORIES.map((cat) => {
            const visuals = getVisualsByCategory(cat.id);
            if (visuals.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground/80 px-1">
                  {cat.label}
                </span>
                <div className="grid grid-cols-5 gap-1 p-1 rounded-lg border border-border/70 bg-muted/20">
                  {visuals.map((vt) => {
                    const Icon = vt.icon;
                    const isActive = config.visualType === vt.id;

                    return (
                      <button
                        key={vt.id}
                        type="button"
                        onClick={() => updateWidgetVisualType(widgetId, vt.id as VisualType)}
                        title={`${vt.label}: ${vt.description}`}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-md gap-1 transition-all cursor-pointer text-center relative group ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="text-[8.5px] tracking-tight leading-tight line-clamp-1">
                          {vt.label.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Pozos de Configuración según el registro */}
      <div className="space-y-3 pt-1 border-t border-border/60">
        {/* Pozos de Dimensión: Eje / Categoría */}
        {axisWell && (
          <WellSection
            title={axisWell.label || "Eje (Dimensión)"}
            required={(axisWell.min ?? 0) > 0}
            wellDef={axisWell}
            currentValue={dataConfig.axis}
            availableFields={dimensions}
            onSelectField={(fId) => assignFieldToWell(widgetId, "axis", fId)}
            onRemoveField={() => removeFieldFromWell(widgetId, "axis")}
          >
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

        {/* Pozo de Dimensión secundaria: Leyenda */}
        {legendWell && (
          <WellSection
            title={legendWell.label || "Leyenda (Desglose)"}
            required={(legendWell.min ?? 0) > 0}
            wellDef={legendWell}
            currentValue={dataConfig.legend}
            availableFields={dimensions.filter((d) => d.id !== dataConfig.axis)}
            onSelectField={(fId) => assignFieldToWell(widgetId, "legend", fId)}
            onRemoveField={() => removeFieldFromWell(widgetId, "legend")}
          />
        )}

        {/* Pozos de Medidas: Normal o Split (Combo) */}
        {isCombo ? (
          <>
            {valuesColumnWell && (
              <MeasuresWellSection
                title={valuesColumnWell.label || "Valores de columnas"}
                required={(valuesColumnWell.min ?? 0) > 0}
                wellDef={valuesColumnWell}
                measures={dataConfig.values}
                availableMeasures={measures}
                filterSeries="column"
                defaultSeries="column"
                showSeriesToggle={true}
                onAddMeasure={(fieldId) => assignFieldToWell(widgetId, "values_column", fieldId)}
                onRemoveMeasure={(idx) => removeFieldFromWell(widgetId, "values", idx)}
                onUpdateAggregation={(idx, agg) => updateMeasureAggregation(widgetId, idx, agg)}
                onToggleSeries={handleToggleSeries}
              />
            )}

            {valuesLineWell && (
              <MeasuresWellSection
                title={valuesLineWell.label || "Valores de línea"}
                required={(valuesLineWell.min ?? 0) > 0}
                wellDef={valuesLineWell}
                measures={dataConfig.values}
                availableMeasures={measures}
                filterSeries="line"
                defaultSeries="line"
                showSeriesToggle={true}
                onAddMeasure={(fieldId) => assignFieldToWell(widgetId, "values_line", fieldId)}
                onRemoveMeasure={(idx) => removeFieldFromWell(widgetId, "values", idx)}
                onUpdateAggregation={(idx, agg) => updateMeasureAggregation(widgetId, idx, agg)}
                onToggleSeries={handleToggleSeries}
              />
            )}
          </>
        ) : (
          valuesWell && (
            <MeasuresWellSection
              title={valuesWell.label || "Valores (Medidas)"}
              required={(valuesWell.min ?? 0) > 0}
              wellDef={valuesWell}
              measures={dataConfig.values}
              availableMeasures={measures}
              onAddMeasure={(fieldId) => assignFieldToWell(widgetId, "values", fieldId)}
              onRemoveMeasure={(idx) => removeFieldFromWell(widgetId, "values", idx)}
              onUpdateAggregation={(idx, agg) => updateMeasureAggregation(widgetId, idx, agg)}
            />
          )
        )}

        {/* Pozo de Filtro de Fechas Relativas */}
        <DateRangeWellSection
          dateRange={dataConfig.dateRange}
          isTransactional={isTransactional}
          defaultDateField={defaultDateField}
          datasetFields={currentFields}
          onUpdateDateRange={(dr) => updateWidgetDateRange(widgetId, dr)}
        />

        {/* Pozo de Orden y Top N */}
        <SortAndLimitSection
          sort={dataConfig.sort}
          limit={dataConfig.limit}
          axisField={dataConfig.axis}
          measures={dataConfig.values}
          onUpdateSort={(s) => updateWidgetSort(widgetId, s)}
          onUpdateLimit={(l) => updateWidgetLimit(widgetId, l)}
        />

        {/* 3. Árbol de Campos integrado directamente debajo de los pozos (Sección Colapsable) */}
        <FieldsTreeSection
          datasetLabel={currentDatasetLabel}
          dimensions={dimensions}
          measures={measures}
          axisWellDef={axisWell}
          legendWellDef={legendWell}
          valuesWellDef={isCombo ? valuesColumnWell : valuesWell}
          currentAxis={dataConfig.axis}
          currentLegend={dataConfig.legend}
          currentValuesCount={dataConfig.values.length}
          onAssignDimension={(role, fId) => assignFieldToWell(widgetId, role, fId)}
          onAssignMeasure={(fId) =>
            assignFieldToWell(widgetId, isCombo ? "values_column" : "values", fId)
          }
        />
      </div>
    </div>
  );
}
