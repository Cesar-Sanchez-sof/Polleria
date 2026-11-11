import { z } from "zod";

/**
 * Tipos de visualización soportados en el estilo Power BI
 */
export const visualTypeSchema = z.enum([
  "column",
  "bar",
  "line",
  "area",
  "pie",
  "donut",
  "card",
  "table",
  "slicer",
]);

export type VisualType = z.infer<typeof visualTypeSchema>;

/**
 * Granularidades soportadas para campos de fecha/hora en zona horaria America/Lima (UTC-5)
 */
export const dateGranularitySchema = z.enum([
  "year",
  "quarter",
  "month",
  "weekday",
  "day",
  "hour",
  "hourOfDay",
]);

export type DateGranularity = z.infer<typeof dateGranularitySchema>;

/**
 * Operadores para reglas de filtrado
 */
export const filterOperatorSchema = z.enum([
  "eq",
  "neq",
  "in",
  "between",
  "gt",
  "lt",
  "startsWith",
  // Aliases retrocompatibles
  "equals",
  "notEquals",
  "contains",
  "greaterThan",
  "lessThan",
  "greaterOrEqual",
  "lessOrEqual",
]);

export type FilterOperator = z.infer<typeof filterOperatorSchema>;

export const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export type FilterValue = z.infer<typeof filterValueSchema>;

export const filterRuleSchema = z.object({
  field: z.string(),
  operator: filterOperatorSchema,
  value: filterValueSchema,
});

export type FilterRule = z.infer<typeof filterRuleSchema>;

/**
 * Agregación de valores numéricos / medidas
 */
export const measureAggregationSchema = z.enum([
  "sum",
  "avg",
  "count",
  "min",
  "max",
  "countDistinct",
]);

export type MeasureAggregation = z.infer<typeof measureAggregationSchema>;

export const widgetValueFieldSchema = z.object({
  field: z.string(),
  agg: measureAggregationSchema,
});

export type WidgetValueField = z.infer<typeof widgetValueFieldSchema>;

export const widgetSortSchema = z.object({
  by: z.string(),
  dir: z.enum(["asc", "desc"]),
});

export type WidgetSort = z.infer<typeof widgetSortSchema>;

/**
 * Presets de rango de fecha relativa calculados en America/Lima
 */
export const datePresetSchema = z.enum([
  "today",
  "yesterday",
  "last7",
  "last30",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "custom",
]);

export type DatePreset = z.infer<typeof datePresetSchema>;

export const widgetDateRangeSchema = z.object({
  field: z.string(),
  preset: datePresetSchema,
  from: z.string().optional(),
  to: z.string().optional(),
});

export type WidgetDateRange = z.infer<typeof widgetDateRangeSchema>;

/**
 * Capa de Datos del Widget (independiente de la visualización)
 */
export const widgetDataConfigSchema = z.object({
  dataset: z.string(),
  axis: z.string().optional(), // Eje X (Dimensión)
  category: z.string().optional(), // Alias para Categoría en gráficos circulares/donas
  legend: z.string().optional(), // Leyenda / Desglose
  values: z.array(widgetValueFieldSchema),
  filters: z.array(filterRuleSchema).optional(),
  dateRange: widgetDateRangeSchema.optional(),
  sort: widgetSortSchema.optional(),
  granularity: dateGranularitySchema.optional(),
  limit: z.number().int().positive().optional(),
});

export type WidgetDataConfig = z.infer<typeof widgetDataConfigSchema>;
export type WidgetDataConfigOutput = z.infer<typeof widgetDataConfigSchema>;


export const DEFAULT_PALETTES: Record<string, string[]> = {
  modern: ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"],
  warm: ["#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#059669"],
  cool: ["#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#9333ea", "#c026d3"],
  polleria: ["#b91c1c", "#f97316", "#eab308", "#15803d", "#0369a1", "#6d28d9"],
};

/**
 * Formato y Estilos visuales del Widget
 */
export const widgetFormatConfigSchema = z.object({
  title: z
    .object({
      show: z.boolean().default(true),
      text: z.string().default("Visual"),
      fontSize: z.number().default(14),
      color: z.string().default("#1e293b"),
      align: z.enum(["left", "center", "right"]).or(z.string()).default("left"),
    })
    .default({
      show: true,
      text: "Visual",
      fontSize: 14,
      color: "#1e293b",
      align: "left",
    }),
  colors: z
    .object({
      palette: z.string().default("polleria"),
      series: z.array(z.string()).default(DEFAULT_PALETTES.polleria),
      custom: z.array(z.string()).optional(),
    })
    .default({
      palette: "polleria",
      series: DEFAULT_PALETTES.polleria,
    }),
  dataLabels: z
    .object({
      show: z.boolean().default(false),
      color: z.string().default("#64748b"),
      fontSize: z.number().default(11),
      position: z.string().optional(),
    })
    .default({
      show: false,
      color: "#64748b",
      fontSize: 11,
    }),
  legend: z
    .object({
      show: z.boolean().default(true),
      position: z.enum(["top", "bottom", "left", "right"]).default("top"),
    })
    .default({
      show: true,
      position: "top",
    }),
  axes: z
    .object({
      xTitle: z.string().optional().default(""),
      yTitle: z.string().optional().default(""),
      showGrid: z.boolean().default(true),
    })
    .default({
      xTitle: "",
      yTitle: "",
      showGrid: true,
    }),
  background: z
    .object({
      color: z.string().default("#ffffff"),
    })
    .default({
      color: "#ffffff",
    }),
  border: z
    .object({
      show: z.boolean().default(false),
      color: z.string().default("#e2e8f0"),
      radius: z.number().default(12),
      width: z.number().default(1),
    })
    .default({
      show: false,
      color: "#e2e8f0",
      radius: 12,
      width: 1,
    }),
  numberFormat: z
    .object({
      decimals: z.number().int().min(0).max(4).default(2),
      prefix: z.string().default("S/ "),
      compact: z.boolean().default(false),
    })
    .default({
      decimals: 2,
      prefix: "S/ ",
      compact: false,
    }),
});

export type WidgetFormatConfig = z.infer<typeof widgetFormatConfigSchema>;

/**
 * Esquema Zod completo y tipos estrictos para el campo config (JSON) de DashboardWidget
 */
export const widgetConfigSchema = z.object({
  visualType: visualTypeSchema,
  data: widgetDataConfigSchema,
  format: widgetFormatConfigSchema,
});

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;


/**
 * Constructor de configuración por defecto para un nuevo widget
 */
export function createDefaultWidgetConfig(
  visualType: VisualType = "column",
  titleText: string = "Nuevo Gráfico",
  dataset: string = "ventas"
): WidgetConfig {
  return {
    visualType,
    data: {
      dataset,
      axis: "fecha",
      values: [{ field: "total", agg: "sum" }],
      filters: [],
      sort: { by: "total", dir: "desc" },
      granularity: "month",
      limit: 100,
    },
    format: {
      title: {
        show: true,
        text: titleText,
        fontSize: 14,
        color: "#1e293b",
        align: "left",
      },
      colors: {
        palette: "polleria",
        series: DEFAULT_PALETTES.polleria,
      },
      dataLabels: {
        show: false,
        color: "#64748b",
        fontSize: 11,
      },
      legend: {
        show: true,
        position: "top",
      },
      axes: {
        xTitle: "",
        yTitle: "Monto (S/)",
        showGrid: true,
      },
      background: {
        color: "#ffffff",
      },
      border: {
        show: true,
        color: "#e2e8f0",
        radius: 12,
        width: 1,
      },
      numberFormat: {
        decimals: 2,
        prefix: "S/ ",
        compact: false,
      },
    },
  };
}
