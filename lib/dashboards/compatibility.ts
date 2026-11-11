import type { WidgetConfig, VisualType } from "./widget-schema";

/**
 * Matriz de compatibilidad entre tipos de visualización estilo Power BI.
 * 
 * Al cambiar de tipo de visual, se conservan los campos compatibles en los nuevos pozos:
 * - column / bar / line / area: Eje (1 dim), Leyenda (0-1 dim), Valores (1+ medidas).
 * - pie / donut: Categoría/Eje (1 dim), Valores (1 medida). Descarta leyenda.
 * - card: Valores (1 medida). Descarta eje, leyenda y granularidad.
 * - table: Columnas completas (conserva eje, leyenda y todas las medidas).
 * - slicer: Campo filtro/eje (1 dim). Descarta medidas y leyenda.
 */
export function migrateWidgetConfigOnVisualTypeChange(
  currentConfig: WidgetConfig,
  newVisualType: VisualType
): WidgetConfig {
  const currentData = currentConfig.data;
  const rawData = currentData as Record<string, unknown>;
  const newValues = [...currentData.values];

  let nextAxis: string | undefined = currentData.axis ?? (rawData.category as string | undefined);
  let nextLegend: string | undefined = currentData.legend;
  let nextGranularity = currentData.granularity;
  let finalValues = newValues;

  switch (newVisualType) {
    case "card": {
      // Solo permite 1 medida; descarta eje y leyenda
      nextAxis = undefined;
      nextLegend = undefined;
      nextGranularity = undefined;
      finalValues = newValues.slice(0, 1);
      break;
    }
    case "pie":
    case "donut": {
      // Categoría (1 dimensión) y 1 medida; descarta pozo de leyenda
      nextLegend = undefined;
      finalValues = newValues.slice(0, 1);
      break;
    }
    case "column":
    case "bar":
    case "line":
    case "area": {
      // Conserva eje, leyenda y todas las medidas
      break;
    }
    case "table": {
      // Conserva todo para mostrar en columnas tabulares
      break;
    }
    case "slicer": {
      // Solo dimensión de corte
      nextLegend = undefined;
      finalValues = [];
      break;
    }
    default:
      break;
  }

  // Al cambiar de tipo, no heredar títulos de eje inconsistentes si el nuevo tipo no usa ejes
  const axesVisualTypes: VisualType[] = ["column", "bar", "line", "area"];
  const isAxesType = axesVisualTypes.includes(newVisualType);
  const currentAxes = currentConfig.format.axes;
  const nextAxes = {
    ...currentAxes,
    xTitle: isAxesType ? currentAxes.xTitle : "",
    yTitle: isAxesType ? currentAxes.yTitle : "",
  };

  return {
    ...currentConfig,
    visualType: newVisualType,
    data: {
      ...currentData,
      axis: nextAxis,
      legend: nextLegend,
      granularity: nextGranularity,
      values: finalValues,
    },
    format: {
      ...currentConfig.format,
      axes: nextAxes,
    },
  };
}
