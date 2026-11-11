import { describe, it, expect } from "vitest";
import {
  getLimaDateParts,
  getLimaCurrentMonthRange,
  getLimaTodayRange,
} from "@/lib/dashboards/date-utils";
import {
  adaptLegacyWidget,
  createConfigForDataset,
} from "@/lib/dashboards/legacy-adapter";
import { widgetConfigSchema } from "@/lib/dashboards/widget-schema";

describe("UI Parte A: Utilidades de Fechas en Lima (Intl.DateTimeFormat)", () => {
  it("calcula noviembre correctamente cuando el reloj UTC marca 2026-12-01T03:00:00Z (22:00 del 30 nov Lima)", () => {
    // 03:00:00Z del 1 de diciembre es 22:00:00 del 30 de noviembre en UTC-5
    const testDate = new Date("2026-12-01T03:00:00Z");

    const parts = getLimaDateParts(testDate);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(11);
    expect(parts.day).toBe(30);
    expect(parts.hour).toBe(22);
    expect(parts.minute).toBe(0);

    const monthRange = getLimaCurrentMonthRange(testDate);
    expect(monthRange).toEqual(["2026-11-01", "2026-11-30"]);

    const todayRange = getLimaTodayRange(testDate);
    expect(todayRange).toEqual(["2026-11-30", "2026-11-30"]);
  });

  it("calcula correctamente meses bisiestos y rangos a inicios de mes", () => {
    // 2024 fue bisiesto: febrero tiene 29 días
    const leapDate = new Date("2024-02-15T15:00:00Z");
    const leapMonthRange = getLimaCurrentMonthRange(leapDate);
    expect(leapMonthRange).toEqual(["2024-02-01", "2024-02-29"]);
  });
});

describe("UI Parte A: Adaptador de Compatibilidad para Widgets Antiguos (Legacy Adapter)", () => {
  const refDate = new Date("2026-11-10T15:00:00Z"); // 10 de nov en Lima

  it("adapta 'Ventas Totales del Día' a card de ventas con total sum y dateRange thisMonth en fecha", () => {
    const legacy = {
      id: "w1",
      title: "Ventas Totales del Día",
      type: "kpi",
      metricKey: "sales_total",
    };

    const config = adaptLegacyWidget(legacy, refDate);
    expect(config.visualType).toBe("card");
    expect(config.data.dataset).toBe("ventas");
    expect(config.data.values).toEqual([{ field: "total", agg: "sum" }]);
    expect(config.data.dateRange).toEqual({ field: "fecha", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("adapta 'Pedidos Realizados' a card de pedidos con numPedidos count y dateRange thisMonth en fechaHora", () => {
    const legacy = {
      id: "w2",
      title: "Pedidos Realizados",
      type: "kpi",
      metricKey: "orders_count",
    };

    const config = adaptLegacyWidget(legacy, refDate);
    expect(config.visualType).toBe("card");
    expect(config.data.dataset).toBe("pedidos");
    expect(config.data.values).toEqual([{ field: "numPedidos", agg: "count" }]);
    expect(config.data.dateRange).toEqual({ field: "fechaHora", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("adapta 'Ticket Promedio' a card de pedidos con ticketPromedio avg y dateRange thisMonth en fechaHora", () => {
    const legacy = {
      id: "w3",
      title: "Ticket Promedio",
      type: "kpi",
      metricKey: "avg_ticket",
    };

    const config = adaptLegacyWidget(legacy, refDate);
    expect(config.visualType).toBe("card");
    expect(config.data.dataset).toBe("pedidos");
    expect(config.data.values).toEqual([{ field: "ticketPromedio", agg: "avg" }]);
    expect(config.data.dateRange).toEqual({ field: "fechaHora", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("adapta 'Top Platos Más Vendidos' a bar de platos_vendidos con eje producto, limit 6 y dateRange thisMonth", () => {
    const legacy = {
      id: "w4",
      title: "Top Platos Más Vendidos",
      type: "chart",
      metricKey: "top_products",
    };

    const config = adaptLegacyWidget(legacy, refDate);
    expect(config.visualType).toBe("bar");
    expect(config.data.dataset).toBe("platos_vendidos");
    expect(config.data.axis).toBe("producto");
    expect(config.data.values).toEqual([{ field: "cantidad", agg: "sum" }]);
    expect(config.data.limit).toBe(6);
    expect(config.data.sort).toEqual({ by: "cantidad_sum", dir: "desc" });
    expect(config.data.dateRange).toEqual({ field: "fechaHora", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("adapta 'Flujo de Ingresos por Hora' a line de ventas con eje fechaCreacion (hourOfDay) y dateRange thisMonth en fecha", () => {
    const legacy = {
      id: "w5",
      title: "Flujo de Ingresos por Hora",
      type: "chart",
      metricKey: "hourly_sales",
    };

    const config = adaptLegacyWidget(legacy, refDate);
    expect(config.visualType).toBe("line");
    expect(config.data.dataset).toBe("ventas");
    expect(config.data.axis).toBe("fechaCreacion");
    expect(config.data.granularity).toBe("hourOfDay");
    expect(config.data.values).toEqual([{ field: "total", agg: "sum" }]);
    expect(config.data.dateRange).toEqual({ field: "fecha", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("convierte 'Ocupación de Mesas' u otros sin equivalente a un placeholder 'Visual sin configurar'", () => {
    const legacy = {
      id: "w6",
      title: "Ocupación de Mesas",
      type: "custom",
      metricKey: "table_occupancy",
    };

    const config = adaptLegacyWidget(legacy, refDate);
    expect(config.data.dataset).toBe("");
    expect(config.data.values).toEqual([]);
    expect(config.format.title.text).toBe("Ocupación de Mesas");
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("conserva la configuración si el widget ya tiene un config Zod válido", () => {
    const validConfig = {
      visualType: "pie" as const,
      data: {
        dataset: "ventas",
        axis: "tipoComprobante",
        values: [{ field: "total", agg: "sum" as const }],
        filters: [],
      },
      format: {
        title: { text: "Comprobantes por Tipo", show: true, align: "left" as const, fontSize: 14 },
        legend: { show: true, position: "bottom" as const },
        dataLabels: { show: false, position: "outside" as const },
        colors: { palette: "default" },
      },
    };

    const widget = {
      id: "w-valid",
      title: "Comprobantes por Tipo",
      type: "pie",
      metricKey: "ventas",
      config: validConfig,
    };

    const result = adaptLegacyWidget(widget);
    expect(result.visualType).toBe("pie");
    expect(result.data.axis).toBe("tipoComprobante");
    expect(result.data.dataset).toBe("ventas");
  });
});

describe("UI Parte A: Inyección de Filtros en Datasets Transaccionales", () => {
  const refDate = new Date("2026-11-10T15:00:00Z");

  it("inyecta dateRange thisMonth en defaultDateField para datasets transaccionales", () => {
    const config = createConfigForDataset("ventas", {
      isTransactional: true,
      defaultDateField: "fecha",
      refDate,
      visualType: "column",
      title: "Ventas Mensuales",
    });

    expect(config.data.dataset).toBe("ventas");
    expect(config.data.dateRange).toEqual({ field: "fecha", preset: "thisMonth" });
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });

  it("no inyecta filtro de fechas si el dataset no es transaccional", () => {
    const config = createConfigForDataset("platos", {
      isTransactional: false,
      title: "Catálogo de Platos",
    });

    expect(config.data.dateRange).toBeUndefined();
    expect(config.data.filters).toEqual([]);
    expect(widgetConfigSchema.safeParse(config).success).toBe(true);
  });
});
