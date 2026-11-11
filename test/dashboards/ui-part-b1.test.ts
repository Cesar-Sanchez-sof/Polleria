import { describe, it, expect, beforeEach } from "vitest";
import { resolveDateRange } from "@/lib/dashboards/date-utils";
import { migrateWidgetConfigOnVisualTypeChange } from "@/lib/dashboards/compatibility";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import {
  createDefaultWidgetConfig,
  widgetConfigSchema,
} from "@/lib/dashboards/widget-schema";
import {
  adaptLegacyWidget,
  createUnconfiguredWidgetConfig,
} from "@/lib/dashboards/legacy-adapter";

describe("UI Parte B1: resolveDateRange (Relativo en America/Lima)", () => {
  // Reloj fijo en 03:00:00Z del 1 de diciembre = 22:00:00 del 30 de noviembre en Lima (UTC-5)
  const fixedNow = new Date("2026-12-01T03:00:00Z");

  it("today devuelve 2026-11-30", () => {
    const range = resolveDateRange({ field: "fecha", preset: "today" }, fixedNow);
    expect(range).toEqual(["2026-11-30", "2026-11-30"]);
  });

  it("yesterday devuelve 2026-11-29", () => {
    const range = resolveDateRange({ field: "fecha", preset: "yesterday" }, fixedNow);
    expect(range).toEqual(["2026-11-29", "2026-11-29"]);
  });

  it("thisMonth devuelve todo noviembre 2026", () => {
    const range = resolveDateRange({ field: "fecha", preset: "thisMonth" }, fixedNow);
    expect(range).toEqual(["2026-11-01", "2026-11-30"]);
  });

  it("lastMonth devuelve todo octubre 2026", () => {
    const range = resolveDateRange({ field: "fecha", preset: "lastMonth" }, fixedNow);
    expect(range).toEqual(["2026-10-01", "2026-10-31"]);
  });

  it("last7 devuelve del 24-nov al 30-nov (7 días inclusivos)", () => {
    const range = resolveDateRange({ field: "fecha", preset: "last7" }, fixedNow);
    expect(range).toEqual(["2026-11-24", "2026-11-30"]);
  });

  it("thisYear devuelve del 01-ene al 31-dic de 2026", () => {
    const range = resolveDateRange({ field: "fecha", preset: "thisYear" }, fixedNow);
    expect(range).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it("custom devuelve from y to especificados", () => {
    const range = resolveDateRange(
      { field: "fecha", preset: "custom", from: "2026-05-01", to: "2026-05-15" },
      fixedNow
    );
    expect(range).toEqual(["2026-05-01", "2026-05-15"]);
  });
});

describe("UI Parte B1: Matriz de Compatibilidad al cambiar visualType", () => {
  it("de column a card: descarta eje y leyenda, y recorta a 1 sola medida", () => {
    const initialConfig = createDefaultWidgetConfig("column", "Ventas por Tipo", "ventas");
    initialConfig.data.axis = "tipoComprobante";
    initialConfig.data.legend = "serie";
    initialConfig.data.granularity = "month";
    initialConfig.data.values = [
      { field: "total", agg: "sum" },
      { field: "igv", agg: "sum" },
      { field: "id", agg: "count" },
    ];

    const migrated = migrateWidgetConfigOnVisualTypeChange(initialConfig, "card");
    expect(migrated.visualType).toBe("card");
    expect(migrated.data.axis).toBeUndefined();
    expect(migrated.data.legend).toBeUndefined();
    expect(migrated.data.granularity).toBeUndefined();
    expect(migrated.data.values).toEqual([{ field: "total", agg: "sum" }]);
  });

  it("de column a pie: conserva eje como categoría, descarta leyenda y recorta a 1 medida", () => {
    const initialConfig = createDefaultWidgetConfig("column", "Ventas", "ventas");
    initialConfig.data.axis = "tipoComprobante";
    initialConfig.data.legend = "serie";
    initialConfig.data.values = [
      { field: "total", agg: "sum" },
      { field: "subtotal", agg: "sum" },
    ];

    const migrated = migrateWidgetConfigOnVisualTypeChange(initialConfig, "pie");
    expect(migrated.visualType).toBe("pie");
    expect(migrated.data.axis).toBe("tipoComprobante");
    expect(migrated.data.legend).toBeUndefined();
    expect(migrated.data.values).toEqual([{ field: "total", agg: "sum" }]);
  });

  it("de column a line o area: conserva eje, leyenda y todas las medidas", () => {
    const initialConfig = createDefaultWidgetConfig("column", "Evolución", "ventas");
    initialConfig.data.axis = "fecha";
    initialConfig.data.legend = "tipoComprobante";
    initialConfig.data.granularity = "day";
    initialConfig.data.values = [
      { field: "total", agg: "sum" },
      { field: "igv", agg: "sum" },
    ];

    const migrated = migrateWidgetConfigOnVisualTypeChange(initialConfig, "line");
    expect(migrated.visualType).toBe("line");
    expect(migrated.data.axis).toBe("fecha");
    expect(migrated.data.legend).toBe("tipoComprobante");
    expect(migrated.data.granularity).toBe("day");
    expect(migrated.data.values).toHaveLength(2);
  });

  it("de column a table: conserva todas las columnas y medidas", () => {
    const initialConfig = createDefaultWidgetConfig("column", "Detalle", "ventas");
    initialConfig.data.axis = "serie";
    initialConfig.data.values = [{ field: "total", agg: "sum" }];

    const migrated = migrateWidgetConfigOnVisualTypeChange(initialConfig, "table");
    expect(migrated.visualType).toBe("table");
    expect(migrated.data.axis).toBe("serie");
    expect(migrated.data.values).toEqual([{ field: "total", agg: "sum" }]);
  });
});

describe("UI Parte B1: Store Zustand de Edición (Pozos, Agregaciones y Datasets)", () => {
  beforeEach(() => {
    useDashboardEditorStore.getState().resetStore();
  });

  it("asigna campos a los pozos axis, legend y values en tiempo real", () => {
    const widgetId = useDashboardEditorStore.getState().addWidget();

    // Asignar Eje
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "axis", "tipoComprobante");
    let widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.axis).toBe("tipoComprobante");

    // Asignar Leyenda
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "legend", "serie");
    widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.legend).toBe("serie");

    // Asignar Medidas
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "total", "sum");
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "igv", "sum");
    widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.values).toEqual([
      { field: "total", agg: "sum" },
      { field: "igv", agg: "sum" },
    ]);
  });

  it("modifica la agregación de una medida existente", () => {
    const widgetId = useDashboardEditorStore.getState().addWidget();
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "total", "sum");
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "subtotal", "sum");

    // Cambiar la segunda medida a avg
    useDashboardEditorStore.getState().updateMeasureAggregation(widgetId, 1, "avg");
    const widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.values[1]).toEqual({ field: "subtotal", agg: "avg" });
  });

  it("limpia los pozos incompatibles al cambiar de dataset e inyecta dateRange mensual si es transaccional", () => {
    const widgetId = useDashboardEditorStore.getState().addWidget();

    // Asignar campos en dataset anterior
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "axis", "producto");
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "cantidad", "sum");

    // Cambiar a dataset transaccional 'pedidos'
    useDashboardEditorStore.getState().changeWidgetDataset(widgetId, "pedidos", {
      isTransactional: true,
      defaultDateField: "fechaHora",
    });

    const widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.dataset).toBe("pedidos");
    expect(widget?.metricKey).toBe("pedidos");
    expect(widget?.config.data.axis).toBeUndefined();
    expect(widget?.config.data.legend).toBeUndefined();
    expect(widget?.config.data.values).toEqual([]);
    expect(widget?.config.data.dateRange).toEqual({
      field: "fechaHora",
      preset: "thisMonth",
    });
  });

  it("elimina campos de pozos individuales", () => {
    const widgetId = useDashboardEditorStore.getState().addWidget();
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "axis", "fecha");
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "total", "sum");
    useDashboardEditorStore.getState().assignFieldToWell(widgetId, "values", "igv", "sum");

    // Remover axis
    useDashboardEditorStore.getState().removeFieldFromWell(widgetId, "axis");
    let widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.axis).toBeUndefined();

    // Remover primera medida
    useDashboardEditorStore.getState().removeFieldFromWell(widgetId, "values", 0);
    widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.config.data.values).toEqual([{ field: "igv", agg: "sum" }]);
  });
});

describe("UI Parte B1.1: Correcciones Críticas (Compatibilidad, Adaptador Real, Guardado y KPIs)", () => {
  it("Punto 1: Top Platos bar -> donut -> bar conserva eje producto, cantidad sum, sort y limit", () => {
    // Config real generado por el adaptador legacy para Top Platos Más Vendidos
    const topPlatosBar = adaptLegacyWidget({
      title: "Top Platos Más Vendidos",
      type: "bar",
      metricKey: "platos_vendidos",
    });

    expect(topPlatosBar.visualType).toBe("bar");
    expect(topPlatosBar.data.axis).toBe("producto");
    expect(topPlatosBar.data.values).toEqual([{ field: "cantidad", agg: "sum" }]);
    expect(topPlatosBar.data.sort).toEqual({ by: "cantidad_sum", dir: "desc" });
    expect(topPlatosBar.data.limit).toBe(6);
    expect(topPlatosBar.format.axes.xTitle).toBe("Cantidad Vendida");
    expect(topPlatosBar.format.axes.yTitle).toBe("Plato");

    // 1. Migrar bar -> donut
    const topPlatosDonut = migrateWidgetConfigOnVisualTypeChange(topPlatosBar, "donut");
    expect(topPlatosDonut.visualType).toBe("donut");
    expect(topPlatosDonut.data.axis).toBe("producto"); // Categoría conservada
    expect(topPlatosDonut.data.values).toEqual([{ field: "cantidad", agg: "sum" }]);
    expect(topPlatosDonut.data.sort).toEqual({ by: "cantidad_sum", dir: "desc" });
    expect(topPlatosDonut.data.limit).toBe(6);
    // En donut no se deben heredar títulos de eje inconsistentes
    expect(topPlatosDonut.format.axes.xTitle).toBe("");
    expect(topPlatosDonut.format.axes.yTitle).toBe("");

    // 2. Migrar donut -> bar
    const topPlatosBarAgain = migrateWidgetConfigOnVisualTypeChange(topPlatosDonut, "bar");
    expect(topPlatosBarAgain.visualType).toBe("bar");
    expect(topPlatosBarAgain.data.axis).toBe("producto");
    expect(topPlatosBarAgain.data.values).toEqual([{ field: "cantidad", agg: "sum" }]);
    expect(topPlatosBarAgain.data.sort).toEqual({ by: "cantidad_sum", dir: "desc" });
    expect(topPlatosBarAgain.data.limit).toBe(6);
  });

  it("Punto 2: Adaptador legacy reconoce valores reales de BD para 'Flujo de Ingresos por Hora' y valida con Zod", () => {
    // Entrada con valores reales de la BD Neon: title, type: 'line', metricKey: 'ventas'
    const dbWidget = {
      id: "92c90153-de85-437f-96d8-8d956bb562c6",
      title: "Flujo de Ingresos por Hora",
      type: "line",
      metricKey: "ventas",
    };

    const adapted = adaptLegacyWidget(dbWidget);
    expect(adapted.visualType).toBe("line");
    expect(adapted.data.dataset).toBe("ventas");
    expect(adapted.data.axis).toBe("fechaCreacion");
    expect(adapted.data.granularity).toBe("hourOfDay");
    expect(adapted.data.values).toEqual([{ field: "total", agg: "sum" }]);
    expect(adapted.data.dateRange).toEqual({ field: "fecha", preset: "thisMonth" });

    // Verificación estricta de esquema Zod
    const parsed = widgetConfigSchema.safeParse(adapted);
    expect(parsed.success).toBe(true);
  });

  it("Punto 8: KPIs adaptados (Ventas Totales, Pedidos y Ticket) usan preset thisMonth", () => {
    const ventas = adaptLegacyWidget({
      title: "Ventas Totales del Día",
      type: "card",
      metricKey: "ventas",
    });
    expect(ventas.data.dateRange).toEqual({ field: "fecha", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(ventas).success).toBe(true);

    const pedidos = adaptLegacyWidget({
      title: "Pedidos Realizados",
      type: "card",
      metricKey: "pedidos",
    });
    expect(pedidos.data.dateRange).toEqual({ field: "fechaHora", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(pedidos).success).toBe(true);

    const ticket = adaptLegacyWidget({
      title: "Ticket Promedio",
      type: "card",
      metricKey: "pedidos",
    });
    expect(ticket.data.dateRange).toEqual({ field: "fechaHora", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(ticket).success).toBe(true);
  });

  it("Punto 7: Guardado de diseño con visuales sin configurar es 100% válido en Zod y persistible", () => {
    const unconfigured = createUnconfiguredWidgetConfig("Visual sin configurar");
    expect(unconfigured.data.dataset).toBe("");
    expect(unconfigured.data.values).toEqual([]);

    // Pasa validación Zod de WidgetConfig
    const parseResult = widgetConfigSchema.safeParse(unconfigured);
    expect(parseResult.success).toBe(true);

    // Adaptador legacy preserva el config no configurado al recargar
    const reloaded = adaptLegacyWidget({
      id: "test-unconfigured-1",
      title: "Visual sin configurar",
      type: "card",
      metricKey: "",
      config: unconfigured,
    });
    expect(reloaded.data.dataset).toBe("");
    expect(reloaded.data.values).toEqual([]);
    expect(reloaded.format.title.text).toBe("Visual sin configurar");
  });

  it("Punto 3: Formato numérico para tarjeta soporta decimales, prefijo y modo compacto", () => {
    const config = createDefaultWidgetConfig("card", "KPI Ventas", "ventas");
    expect(config.format.numberFormat?.decimals).toBe(2);
    expect(config.format.numberFormat?.prefix).toBe("S/ ");
    expect(config.format.numberFormat?.compact).toBe(false);

    // Personalizar formato numérico
    config.format.numberFormat = {
      decimals: 1,
      prefix: "$ ",
      compact: true,
    };
    const parsed = widgetConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.format.numberFormat.prefix).toBe("$ ");
      expect(parsed.data.format.numberFormat.decimals).toBe(1);
      expect(parsed.data.format.numberFormat.compact).toBe(true);
    }
  });
});
