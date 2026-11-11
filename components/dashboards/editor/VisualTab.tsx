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
}: {
  widgetId: string;
  dimensions: CatalogField[];
  measures: CatalogField[];
  currentFields: CatalogField[];
  isTransactional: boolean;
  defaultDateField?: string;
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
        {registryEntry.wells.some((w) => w.role === "axis") && (
          <WellSection
            title={
              registryEntry.wells.find((w) => w.role === "axis")?.label ||
              "Eje (Dimensión)"
            }
            required={(registryEntry.wells.find((w) => w.role === "axis")?.min ?? 0) > 0}
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
        {registryEntry.wells.some((w) => w.role === "legend") && (
          <WellSection
            title="Leyenda (Desglose)"
            required={false}
            currentValue={dataConfig.legend}
            availableFields={dimensions.filter((d) => d.id !== dataConfig.axis)}
            onSelectField={(fId) => assignFieldToWell(widgetId, "legend", fId)}
            onRemoveField={() => removeFieldFromWell(widgetId, "legend")}
          />
        )}

        {/* Pozos de Medidas: Normal o Split (Combo) */}
        {isCombo ? (
          <>
            <MeasuresWellSection
              title="Valores de columnas"
              required={true}
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

            <MeasuresWellSection
              title="Valores de línea"
              required={false}
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
          </>
        ) : (
          registryEntry.wells.some((w) => w.role === "values") && (
            <MeasuresWellSection
              title={registryEntry.wells.find((w) => w.role === "values")?.label || "Valores (Medidas)"}
              required={(registryEntry.wells.find((w) => w.role === "values")?.min ?? 0) > 0}
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
      </div>
    </div>
  );
}
