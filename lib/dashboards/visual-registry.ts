import type { ComponentType } from "react";
import {
  BarChart3,
  BarChart2,
  Percent,
  AlignLeft,
  AlignJustify,
  LineChart,
  AreaChart,
  Layers,
  SlidersHorizontal,
  PieChart,
  Disc,
  Hash,
  Gauge,
  Table as TableIcon,
  Filter,
  Radar as RadarIcon,
  Funnel,
  LayoutGrid,
} from "lucide-react";
import type {
  VisualType,
  WidgetConfig,
  WidgetValueField,
} from "./widget-schema";

export type VisualCategory =
  | "bars_columns"
  | "lines_areas"
  | "pies"
  | "cards_kpis"
  | "advanced"
  | "tables";

export type WellRole =
  | "axis"
  | "legend"
  | "values"
  | "values_column"
  | "values_line";

export interface VisualWellDefinition {
  role: WellRole;
  label: string;
  accepts: "dimension" | "measure";
  min: number;
  max?: number;
  description?: string;
}

export interface VisualRegistryFormatOptions {
  axes: boolean;
  legend: boolean;
  dataLabels: boolean;
  gridlines: boolean;
  secondaryAxis?: boolean;
  gauge?: boolean;
  numberFormat?: boolean;
}

export interface VisualRegistryEntry {
  id: VisualType;
  label: string;
  category: VisualCategory;
  categoryLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  wells: VisualWellDefinition[];
  defaultSize: { w: number; h: number };
  format: VisualRegistryFormatOptions;
}

export const VISUAL_CATEGORIES: Array<{ id: VisualCategory; label: string }> = [
  { id: "bars_columns", label: "Barras y Columnas" },
  { id: "lines_areas", label: "Líneas y Áreas" },
  { id: "pies", label: "Circulares" },
  { id: "cards_kpis", label: "Tarjetas y KPIs" },
  { id: "advanced", label: "Avanzados" },
  { id: "tables", label: "Tablas y Filtros" },
];

export const VISUAL_REGISTRY: Record<VisualType, VisualRegistryEntry> = {
  // 1. Columnas y Barras
  column: {
    id: "column",
    label: "Columnas agrupadas",
    category: "bars_columns",
    categoryLabel: "Barras y Columnas",
    description: "Compara valores numéricos entre categorías con barras verticales.",
    icon: BarChart3,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  stackedColumn: {
    id: "stackedColumn",
    label: "Columnas apiladas",
    category: "bars_columns",
    categoryLabel: "Barras y Columnas",
    description: "Muestra la relación de partes respecto al total en barras verticales apiladas.",
    icon: BarChart2,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  percentColumn: {
    id: "percentColumn",
    label: "Columnas 100% apiladas",
    category: "bars_columns",
    categoryLabel: "Barras y Columnas",
    description: "Compara la proporción porcentual (100%) que aporta cada serie al total.",
    icon: Percent,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  bar: {
    id: "bar",
    label: "Barras agrupadas",
    category: "bars_columns",
    categoryLabel: "Barras y Columnas",
    description: "Ideal para nombres largos de productos o categorías en orientación horizontal.",
    icon: AlignLeft,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  stackedBar: {
    id: "stackedBar",
    label: "Barras apiladas",
    category: "bars_columns",
    categoryLabel: "Barras y Columnas",
    description: "Barras horizontales apiladas para comparar totales y desgloses secundarios.",
    icon: AlignJustify,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  percentBar: {
    id: "percentBar",
    label: "Barras 100% apiladas",
    category: "bars_columns",
    categoryLabel: "Barras y Columnas",
    description: "Barras horizontales normalizadas al 100% para evaluar porcentajes relativos.",
    icon: Percent,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },

  // 2. Líneas y Áreas
  line: {
    id: "line",
    label: "Líneas",
    category: "lines_areas",
    categoryLabel: "Líneas y Áreas",
    description: "Muestra tendencias y evoluciones cronológicas de series de datos continuos.",
    icon: LineChart,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  area: {
    id: "area",
    label: "Áreas",
    category: "lines_areas",
    categoryLabel: "Líneas y Áreas",
    description: "Visualiza magnitud acumulada a lo largo del tiempo resaltando el volumen total.",
    icon: AreaChart,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  stackedArea: {
    id: "stackedArea",
    label: "Áreas apiladas",
    category: "lines_areas",
    categoryLabel: "Líneas y Áreas",
    description: "Muestra cómo múltiples series contribuyen a una tendencia continua total.",
    icon: Layers,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda (Desglose)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true },
  },
  combo: {
    id: "combo",
    label: "Columnas y Líneas (Combo)",
    category: "lines_areas",
    categoryLabel: "Líneas y Áreas",
    description: "Combina columnas y líneas en el mismo gráfico con soporte de eje secundario.",
    icon: SlidersHorizontal,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Dimensión)", accepts: "dimension", min: 1, max: 1 },
      { role: "values_column", label: "Valores de columnas", accepts: "measure", min: 1 },
      { role: "values_line", label: "Valores de línea", accepts: "measure", min: 0 },
    ],
    format: { axes: true, legend: true, dataLabels: true, gridlines: true, secondaryAxis: true },
  },

  // 3. Circulares
  pie: {
    id: "pie",
    label: "Circular (Pie)",
    category: "pies",
    categoryLabel: "Circulares",
    description: "Muestra proporciones de un número pequeño de categorías (1 dimensión y 1 medida).",
    icon: PieChart,
    defaultSize: { w: 4, h: 3 },
    wells: [
      { role: "axis", label: "Categoría", accepts: "dimension", min: 1, max: 1 },
      { role: "values", label: "Valores (Medida)", accepts: "measure", min: 1, max: 1 },
    ],
    format: { axes: false, legend: true, dataLabels: true, gridlines: false },
  },
  donut: {
    id: "donut",
    label: "Anillo (Donut)",
    category: "pies",
    categoryLabel: "Circulares",
    description: "Gráfico circular con espacio central para un diseño moderno y despejado.",
    icon: Disc,
    defaultSize: { w: 4, h: 3 },
    wells: [
      { role: "axis", label: "Categoría", accepts: "dimension", min: 1, max: 1 },
      { role: "values", label: "Valores (Medida)", accepts: "measure", min: 1, max: 1 },
    ],
    format: { axes: false, legend: true, dataLabels: true, gridlines: false },
  },

  // 4. Tarjetas y KPIs
  card: {
    id: "card",
    label: "Tarjeta KPI",
    category: "cards_kpis",
    categoryLabel: "Tarjetas y KPIs",
    description: "Destaca un número clave o métrica principal con formato de moneda o unidades.",
    icon: Hash,
    defaultSize: { w: 3, h: 2 },
    wells: [
      { role: "values", label: "Valor (Medida)", accepts: "measure", min: 1, max: 1 },
    ],
    format: { axes: false, legend: false, dataLabels: false, gridlines: false, numberFormat: true },
  },
  gauge: {
    id: "gauge",
    label: "Medidor (Gauge)",
    category: "cards_kpis",
    categoryLabel: "Tarjetas y KPIs",
    description: "Tacómetro semicircular con valor actual, mínimo, máximo y meta objetivo.",
    icon: Gauge,
    defaultSize: { w: 4, h: 3 },
    wells: [
      { role: "values", label: "Valor (Medida)", accepts: "measure", min: 1, max: 1 },
    ],
    format: { axes: false, legend: false, dataLabels: false, gridlines: false, gauge: true, numberFormat: true },
  },

  // 5. Avanzados
  radar: {
    id: "radar",
    label: "Radar",
    category: "advanced",
    categoryLabel: "Avanzados",
    description: "Evalúa múltiples variables bidimensionales respecto a un punto central.",
    icon: RadarIcon,
    defaultSize: { w: 5, h: 4 },
    wells: [
      { role: "axis", label: "Eje (Categoría)", accepts: "dimension", min: 1, max: 1 },
      { role: "legend", label: "Leyenda", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 1 },
    ],
    format: { axes: false, legend: true, dataLabels: true, gridlines: true },
  },
  funnel: {
    id: "funnel",
    label: "Embudo (Funnel)",
    category: "advanced",
    categoryLabel: "Avanzados",
    description: "Visualiza etapas secuenciales ordenadas descendentemente por defecto.",
    icon: Funnel,
    defaultSize: { w: 5, h: 4 },
    wells: [
      { role: "axis", label: "Categoría", accepts: "dimension", min: 1, max: 1 },
      { role: "values", label: "Valores (Medida)", accepts: "measure", min: 1, max: 1 },
    ],
    format: { axes: false, legend: true, dataLabels: true, gridlines: false },
  },
  treemap: {
    id: "treemap",
    label: "Treemap",
    category: "advanced",
    categoryLabel: "Avanzados",
    description: "Muestra datos jerárquicos o categorías anidadas mediante rectángulos proporcionales.",
    icon: LayoutGrid,
    defaultSize: { w: 6, h: 4 },
    wells: [
      { role: "axis", label: "Categoría", accepts: "dimension", min: 1, max: 1 },
      { role: "values", label: "Valores (Medida)", accepts: "measure", min: 1, max: 1 },
    ],
    format: { axes: false, legend: true, dataLabels: true, gridlines: false },
  },

  // 6. Tablas y Filtros
  table: {
    id: "table",
    label: "Tabla de datos",
    category: "tables",
    categoryLabel: "Tablas y Filtros",
    description: "Vista tabular detallada con columnas para todas las dimensiones y medidas.",
    icon: TableIcon,
    defaultSize: { w: 8, h: 4 },
    wells: [
      { role: "axis", label: "Filas (Dimensión)", accepts: "dimension", min: 0, max: 1 },
      { role: "legend", label: "Columnas (Dimensión)", accepts: "dimension", min: 0, max: 1 },
      { role: "values", label: "Valores (Medidas)", accepts: "measure", min: 0 },
    ],
    format: { axes: false, legend: false, dataLabels: false, gridlines: false },
  },
  slicer: {
    id: "slicer",
    label: "Segmentador",
    category: "tables",
    categoryLabel: "Tablas y Filtros",
    description: "Filtro interactivo visual para segmentar los demás paneles del tablero.",
    icon: Filter,
    defaultSize: { w: 3, h: 3 },
    wells: [
      { role: "axis", label: "Campo de filtro", accepts: "dimension", min: 1, max: 1 },
    ],
    format: { axes: false, legend: false, dataLabels: false, gridlines: false },
  },
};

export function getVisualRegistryEntry(visualType: VisualType): VisualRegistryEntry {
  const entry = VISUAL_REGISTRY[visualType];
  if (!entry) {
    return VISUAL_REGISTRY.column;
  }
  return entry;
}

export function getVisualsByCategory(category: VisualCategory): VisualRegistryEntry[] {
  return Object.values(VISUAL_REGISTRY).filter((v) => v.category === category);
}

/**
 * Migración estricta de WidgetConfig por rol de pozo (WellRole).
 * 
 * Conserva la compatibilidad entre visualTypes preservando:
 * - Dimensiones asignadas al rol 'axis'
 * - Dimensiones asignadas al rol 'legend'
 * - Medidas asignadas a 'values' o separadas en 'values_column' / 'values_line' (combo)
 * - Filtros, sort y limit
 */
export function migrateWidgetConfigByRole(
  currentConfig: WidgetConfig,
  newVisualType: VisualType
): WidgetConfig {
  const targetEntry = getVisualRegistryEntry(newVisualType);
  const currentData = currentConfig.data;
  const rawData = currentData as Record<string, unknown>;

  // 1. Extraer dimensión principal (axis / category)
  const currentAxis: string | undefined = currentData.axis ?? (rawData.category as string | undefined);
  const currentLegend: string | undefined = currentData.legend;
  const currentGranularity = currentData.granularity;

  // 2. Extraer medidas actuales
  const currentValues: WidgetValueField[] = [...currentData.values];

  // 3. Determinar qué pozos de dimensión acepta el target
  const targetHasAxisWell = targetEntry.wells.some((w) => w.role === "axis");
  const targetHasLegendWell = targetEntry.wells.some((w) => w.role === "legend");

  const nextAxis = targetHasAxisWell ? currentAxis : undefined;
  const nextLegend = targetHasLegendWell ? currentLegend : undefined;
  const nextGranularity = targetHasAxisWell ? currentGranularity : undefined;

  // 4. Mapear medidas (values) según requerimientos del target
  let finalValues: WidgetValueField[] = [];

  if (newVisualType === "combo") {
    // Target es combo: distribuye valores entre 'column' y 'line'
    if (currentValues.length === 0) {
      finalValues = [];
    } else if (currentValues.length === 1) {
      finalValues = [{ ...currentValues[0], series: "column" }];
    } else {
      // 2 o más medidas: la primera a columna, las siguientes a línea (o preserva si ya tenían series)
      finalValues = currentValues.map((val, idx) => ({
        ...val,
        series: val.series || (idx === 0 ? "column" : "line"),
      }));
    }
  } else if (newVisualType === "slicer") {
    // Slicer no requiere medidas
    finalValues = [];
  } else {
    // Target normal: comprueba si tiene límite de 1 medida
    const targetValuesWell = targetEntry.wells.find(
      (w) => w.role === "values" || w.role === "values_column"
    );
    const maxValues = targetValuesWell?.max;

    // Quitar etiqueta de series si el target no es combo
    const cleanedValues = currentValues.map((v) => {
      const copy = { ...v };
      delete copy.series;
      return copy;
    });

    if (maxValues && maxValues > 0) {
      finalValues = cleanedValues.slice(0, maxValues);
    } else {
      finalValues = cleanedValues;
    }
  }

  // Orden por defecto para funnel: si no tiene sort, ordenar desc por la medida
  let nextSort = currentData.sort;
  if (newVisualType === "funnel" && !nextSort && finalValues.length > 0) {
    nextSort = { by: `${finalValues[0].field}_${finalValues[0].agg}`, dir: "desc" };
  }

  // 5. Limpieza de títulos de ejes inconsistentes si el target no usa ejes
  const nextAxes = {
    ...currentConfig.format.axes,
    xTitle: targetEntry.format.axes ? currentConfig.format.axes.xTitle : "",
    yTitle: targetEntry.format.axes ? currentConfig.format.axes.yTitle : "",
    secondaryYTitle: targetEntry.format.secondaryAxis ? currentConfig.format.axes.secondaryYTitle : "",
    showSecondaryY: targetEntry.format.secondaryAxis ? (currentConfig.format.axes.showSecondaryY ?? false) : false,
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
      sort: nextSort,
    },
    format: {
      ...currentConfig.format,
      axes: nextAxes,
    },
  };
}

export interface WellDropValidation {
  valid: boolean;
  error?: string;
}

/**
 * Valida si un campo puede ser soltado o asignado a un pozo según las reglas del registro:
 * - wellDef.accepts ('dimension' vs 'measure')
 * - wellDef.max (límite máximo de campos permitidos en el pozo)
 */
export function validateFieldForWell(
  wellDef: VisualWellDefinition,
  field: { id: string; kind?: string; dataType?: string; label?: string },
  currentCount: number
): WellDropValidation {
  // 1. Determinar tipo de campo
  const isExplicitMeasure = field.kind === "measure";
  const isExplicitDimension = field.kind === "dimension";
  const isNumericType = field.dataType === "number";

  const isMeasure = isExplicitMeasure || (isNumericType && !isExplicitDimension);
  const isDimension = isExplicitDimension || (!isMeasure);

  // 2. Validar 'accepts'
  if (wellDef.accepts === "dimension" && !isDimension) {
    return {
      valid: false,
      error: `El pozo "${wellDef.label}" solo acepta dimensiones, no medidas.`,
    };
  }

  if (wellDef.accepts === "measure" && !isMeasure) {
    return {
      valid: false,
      error: `El pozo "${wellDef.label}" solo acepta medidas numéricas, no dimensiones.`,
    };
  }

  // 3. Validar 'max' (límite máximo del pozo)
  if (wellDef.max !== undefined && wellDef.max !== null) {
    if (currentCount >= wellDef.max) {
      return {
        valid: false,
        error: `El pozo "${wellDef.label}" solo admite un máximo de ${wellDef.max} campo(s).`,
      };
    }
  }

  return { valid: true };
}
