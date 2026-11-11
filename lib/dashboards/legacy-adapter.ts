/**
 * Adaptador de Compatibilidad para Widgets Antiguos (Legacy Adapter).
 * 
 * Convierte widgets antiguos sin campo config (o con config inválido)
 * a un WidgetConfig moderno y validado de estilo Power BI, aplicando
 * fechas calculadas en zona horaria America/Lima.
 */

import {
  type WidgetConfig,
  widgetConfigSchema,
  createDefaultWidgetConfig,
} from "./widget-schema";
import { getLimaTodayRange, getLimaCurrentMonthRange } from "./date-utils";

export interface LegacyWidgetInput {
  id?: string;
  title?: string;
  type?: string;
  metricKey?: string;
  config?: unknown;
}

/**
 * Genera un WidgetConfig no configurado (Placeholder).
 */
export function createUnconfiguredWidgetConfig(title = "Visual sin configurar"): WidgetConfig {
  const base = createDefaultWidgetConfig("column", title, "ventas");
  return {
    ...base,
    visualType: "column",
    data: {
      dataset: "",
      values: [],
      filters: [],
    },
    format: {
      ...base.format,
      title: {
        ...base.format.title,
        text: title,
      },
    },
  };
}

/**
 * Adapta un widget antiguo a la estructura Zod estricta WidgetConfig.
 * Si el widget ya tiene un config válido, lo retorna tal cual.
 */
export function adaptLegacyWidget(
  widget: LegacyWidgetInput,
  refDate: Date = new Date()
): WidgetConfig {
  // 1. Si ya tiene un config válido con el esquema Zod moderno, conservarlo
  if (widget.config) {
    const parseResult = widgetConfigSchema.safeParse(widget.config);
    if (parseResult.success) {
      return parseResult.data;
    }
  }

  const title = (widget.title || "").trim();
  const metricKey = (widget.metricKey || "").trim();
  const todayRange = getLimaTodayRange(refDate);
  const monthRange = getLimaCurrentMonthRange(refDate);

  // 1. Ventas Totales del Día -> card, ventas, total sum, dateRange thisMonth en 'fecha'
  if (
    metricKey === "sales_total" ||
    (metricKey === "ventas" && (!widget.type || widget.type === "card")) ||
    /ventas\s+totales/i.test(title)
  ) {
    const base = createDefaultWidgetConfig("card", title || "Ventas Totales del Día", "ventas");
    const result: WidgetConfig = {
      ...base,
      visualType: "card",
      data: {
        dataset: "ventas",
        values: [{ field: "total", agg: "sum" }],
        dateRange: { field: "fecha", preset: "thisMonth" },
        filters: [],
      },
      format: {
        ...base.format,
        title: { ...base.format.title, text: title || "Ventas Totales del Día" },
        axes: { ...base.format.axes, yTitle: "Soles (S/)" },
      },
    };
    const parsed = widgetConfigSchema.safeParse(result);
    if (!parsed.success) {
      console.error("[adaptLegacyWidget] Ventas Totales validation error:", parsed.error);
    }
    return parsed.success ? parsed.data : result;
  }

  // 2. Pedidos Realizados -> card, pedidos, numPedidos count, dateRange thisMonth en 'fechaHora'
  if (
    metricKey === "orders_count" ||
    (metricKey === "pedidos" && /pedidos/i.test(title)) ||
    /pedidos\s+realizados/i.test(title)
  ) {
    const base = createDefaultWidgetConfig("card", title || "Pedidos Realizados", "pedidos");
    const result: WidgetConfig = {
      ...base,
      visualType: "card",
      data: {
        dataset: "pedidos",
        values: [{ field: "numPedidos", agg: "count" }],
        dateRange: { field: "fechaHora", preset: "thisMonth" },
        filters: [],
      },
      format: {
        ...base.format,
        title: { ...base.format.title, text: title || "Pedidos Realizados" },
        axes: { ...base.format.axes, yTitle: "Nº Comandas" },
      },
    };
    const parsed = widgetConfigSchema.safeParse(result);
    if (!parsed.success) {
      console.error("[adaptLegacyWidget] Pedidos Realizados validation error:", parsed.error);
    }
    return parsed.success ? parsed.data : result;
  }

  // 3. Ticket Promedio -> card, pedidos, ticketPromedio avg, dateRange thisMonth en 'fechaHora'
  if (
    metricKey === "avg_ticket" ||
    (metricKey === "pedidos" && /ticket/i.test(title)) ||
    /ticket\s+promedio/i.test(title)
  ) {
    const base = createDefaultWidgetConfig("card", title || "Ticket Promedio", "pedidos");
    const result: WidgetConfig = {
      ...base,
      visualType: "card",
      data: {
        dataset: "pedidos",
        values: [{ field: "ticketPromedio", agg: "avg" }],
        dateRange: { field: "fechaHora", preset: "thisMonth" },
        filters: [],
      },
      format: {
        ...base.format,
        title: { ...base.format.title, text: title || "Ticket Promedio" },
        axes: { ...base.format.axes, yTitle: "Soles (S/)" },
      },
    };
    const parsed = widgetConfigSchema.safeParse(result);
    if (!parsed.success) {
      console.error("[adaptLegacyWidget] Ticket Promedio validation error:", parsed.error);
    }
    return parsed.success ? parsed.data : result;
  }

  // 4. Top Platos Más Vendidos -> bar, platos_vendidos, eje producto, cantidad sum, sort desc, limit 6, dateRange thisMonth en 'fechaHora'
  if (
    metricKey === "top_products" ||
    metricKey === "platos_vendidos" ||
    /top\s+platos/i.test(title)
  ) {
    const base = createDefaultWidgetConfig("bar", title || "Top Platos Más Vendidos", "platos_vendidos");
    const result: WidgetConfig = {
      ...base,
      visualType: "bar",
      data: {
        dataset: "platos_vendidos",
        axis: "producto",
        values: [{ field: "cantidad", agg: "sum" }],
        sort: { by: "cantidad_sum", dir: "desc" },
        limit: 6,
        dateRange: { field: "fechaHora", preset: "thisMonth" },
        filters: [],
      },
      format: {
        ...base.format,
        title: { ...base.format.title, text: title || "Top Platos Más Vendidos" },
        axes: { ...base.format.axes, xTitle: "Cantidad Vendida", yTitle: "Plato" },
      },
    };
    const parsed = widgetConfigSchema.safeParse(result);
    if (!parsed.success) {
      console.error("[adaptLegacyWidget] Top Platos validation error:", parsed.error);
    }
    return parsed.success ? parsed.data : result;
  }

  // 5. Flujo de Ingresos por Hora -> line, ventas, eje fechaCreacion (hourOfDay), total sum, dateRange thisMonth en 'fecha'
  if (
    metricKey === "hourly_sales" ||
    (metricKey === "ventas" && widget.type === "line") ||
    /flujo.*ingresos/i.test(title) ||
    /ingresos.*hora/i.test(title)
  ) {
    const base = createDefaultWidgetConfig("line", title || "Flujo de Ingresos por Hora", "ventas");
    const result: WidgetConfig = {
      ...base,
      visualType: "line",
      data: {
        dataset: "ventas",
        axis: "fechaCreacion",
        granularity: "hourOfDay",
        values: [{ field: "total", agg: "sum" }],
        dateRange: { field: "fecha", preset: "thisMonth" },
        filters: [],
      },
      format: {
        ...base.format,
        title: { ...base.format.title, text: title || "Flujo de Ingresos por Hora" },
        axes: { ...base.format.axes, xTitle: "Hora del Día (Lima)", yTitle: "Ingresos (S/)" },
      },
    };
    const parsed = widgetConfigSchema.safeParse(result);
    if (!parsed.success) {
      console.error("[adaptLegacyWidget] Flujo de Ingresos validation error:", parsed.error);
    }
    return parsed.success ? parsed.data : result;
  }

  // 6. Ocupación de Mesas, Últimos Pedidos en Vivo u otros sin equivalente -> placeholder "Visual sin configurar"
  return createUnconfiguredWidgetConfig(title || "Visual sin configurar");
}

/**
 * Crea una configuración para un dataset, inyectando automáticamente el filtro between
 * del mes actual en hora de Lima si el dataset es transaccional y tiene defaultDateField.
 */
export function createConfigForDataset(
  dataset: string,
  options?: {
    defaultDateField?: string;
    isTransactional?: boolean;
    visualType?: "column" | "bar" | "line" | "area" | "pie" | "donut" | "card" | "table" | "slicer";
    title?: string;
    refDate?: Date;
  }
): WidgetConfig {
  const visualType = options?.visualType || "column";
  const title = options?.title || "Nuevo Visual";
  const base = createDefaultWidgetConfig(visualType, title, dataset);

  if (options?.isTransactional && options.defaultDateField) {
    base.data.dateRange = {
      field: options.defaultDateField,
      preset: "thisMonth",
    };
    base.data.filters = [];
  }

  return base;
}
