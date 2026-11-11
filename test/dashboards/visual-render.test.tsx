// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { VISUAL_REGISTRY, type VisualRegistryEntry } from "@/lib/dashboards/visual-registry";
import { VISUAL_RENDERERS } from "@/components/dashboards/visuals/renderers";
import { DynamicVisual } from "@/components/dashboards/visuals/DynamicVisual";
import {
  widgetConfigSchema,
  createDefaultWidgetConfig,
  type VisualType,
  type WidgetConfig,
  type WidgetDataConfig,
} from "@/lib/dashboards/widget-schema";
import { validateQueryConfigWhitelist } from "@/lib/services/settings/dashboard-query.service";

// 1. Mock de ResizeObserver para entorno jsdom
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// 2. Mock de ResponsiveContainer de recharts con tamaño fijo para que no dé 0x0
vi.mock("recharts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("recharts")>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

// 3. Generador de datos fixture con campos reales según el dataset
function getFixtureForConfig(dataConfig: WidgetDataConfig) {
  if (dataConfig.dataset === "platos_vendidos") {
    return {
      rows: [
        { producto: "1/4 Pollo a la Brasa", cantidad_sum: 45, importe_sum: 980 },
        { producto: "1/2 Pollo a la Brasa", cantidad_sum: 30, importe_sum: 1200 },
        { producto: "1 Pollo Entero", cantidad_sum: 25, importe_sum: 1750 },
        { producto: "Porción de Papas", cantidad_sum: 50, importe_sum: 500 },
      ],
      meta: {
        axis: dataConfig.axis,
        metrics: dataConfig.values.map((v) => `${v.field}_${v.agg}`),
      },
    };
  }

  if (dataConfig.dataset === "ventas") {
    return {
      rows: [
        { tipoComprobante: "Boleta", tipoPersona: "Natural", total_sum: 4200, igv_sum: 640 },
        { tipoComprobante: "Factura", tipoPersona: "Jurídica", total_sum: 2800, igv_sum: 427 },
        { tipoComprobante: "Ticket", tipoPersona: "Natural", total_sum: 950, igv_sum: 145 },
      ],
      meta: {
        axis: dataConfig.axis,
        metrics: dataConfig.values.map((v) => `${v.field}_${v.agg}`),
      },
    };
  }

  if (dataConfig.dataset === "pedidos") {
    return {
      rows: [
        { fechaHora: "12:00", fechaHora_legend: "Lunes", numPedidos_count: 14 },
        { fechaHora: "13:00", fechaHora_legend: "Lunes", numPedidos_count: 22 },
        { fechaHora: "20:00", fechaHora_legend: "Viernes", numPedidos_count: 38 },
        { fechaHora: "21:00", fechaHora_legend: "Sábado", numPedidos_count: 45 },
      ],
      meta: {
        axis: dataConfig.axis,
        legend: "fechaHora_legend",
        metrics: ["numPedidos_count"],
      },
    };
  }

  return {
    rows: [{ valor_sum: 100 }],
    meta: { metrics: ["valor_sum"] },
  };
}

// 4. Mock del hook useVisualData y useDashboardCatalog
vi.mock("@/lib/hooks/use-visual-data", () => ({
  useVisualData: (dataConfig: WidgetDataConfig) => ({
    data: getFixtureForConfig(dataConfig),
    previousData: {
      rows: [{ total_sum: 3500, cantidad_sum: 30, importe_sum: 800 }],
      meta: { metrics: ["total_sum"] },
    },
    isLoading: false,
    error: null,
    isTruncated: false,
  }),
  useDashboardCatalog: () => ({
    catalog: [
      {
        id: "ventas",
        fields: [
          { id: "tipoComprobante", label: "Tipo de Comprobante" },
          { id: "tipoPersona", label: "Tipo de Persona" },
          { id: "total", label: "Total" },
          { id: "igv", label: "IGV" },
          { id: "fecha", label: "Fecha" },
        ],
      },
      {
        id: "platos_vendidos",
        fields: [
          { id: "producto", label: "Plato / Producto" },
          { id: "cantidad", label: "Cantidad Vendida" },
          { id: "importe", label: "Importe Total" },
        ],
      },
      {
        id: "pedidos",
        fields: [
          { id: "fechaHora", label: "Fecha y Hora del Pedido" },
          { id: "numPedidos", label: "Cantidad de Pedidos" },
        ],
      },
    ],
  }),
}));

/**
 * Fábrica de configs válidos con campos REALES del modelo semántico para cada visualType.
 */
function buildRealConfigForVisual(visualType: VisualType): WidgetConfig {
  const base = createDefaultWidgetConfig(visualType, `Test ${visualType}`);

  switch (visualType) {
    case "column":
      return {
        ...base,
        data: {
          dataset: "platos_vendidos",
          axis: "producto",
          values: [{ field: "cantidad", agg: "sum" }],
          filters: [],
        },
      };

    case "stackedColumn":
    case "percentColumn":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [
            { field: "total", agg: "sum" },
            { field: "igv", agg: "sum" },
          ],
          filters: [],
        },
      };

    case "bar":
      return {
        ...base,
        data: {
          dataset: "platos_vendidos",
          axis: "producto",
          values: [{ field: "importe", agg: "sum" }],
          filters: [],
        },
      };

    case "stackedBar":
    case "percentBar":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoPersona",
          values: [
            { field: "total", agg: "sum" },
            { field: "igv", agg: "sum" },
          ],
          filters: [],
        },
      };

    case "line":
    case "area":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [{ field: "total", agg: "sum" }],
          filters: [],
        },
      };

    case "stackedArea":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [
            { field: "total", agg: "sum" },
            { field: "igv", agg: "sum" },
          ],
          filters: [],
        },
      };

    case "combo":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [
            { field: "total", agg: "sum", series: "column" },
            { field: "igv", agg: "sum", series: "line" },
          ],
          filters: [],
        },
      };

    case "pie":
    case "donut":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [{ field: "total", agg: "sum" }],
          filters: [],
        },
      };

    case "card":
    case "gauge":
      return {
        ...base,
        data: {
          dataset: "ventas",
          values: [{ field: "total", agg: "sum" }],
          filters: [],
        },
      };

    case "kpiTrend":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [{ field: "total", agg: "sum" }],
          dateRange: { field: "fecha", preset: "thisMonth" },
          compare: "previousPeriod",
          filters: [],
        },
      };

    case "multiCard":
      return {
        ...base,
        data: {
          dataset: "ventas",
          values: [
            { field: "total", agg: "sum" },
            { field: "igv", agg: "sum" },
          ],
          filters: [],
        },
      };

    case "table":
      return {
        ...base,
        data: {
          dataset: "platos_vendidos",
          axis: "producto",
          values: [
            { field: "cantidad", agg: "sum" },
            { field: "importe", agg: "sum" },
          ],
          filters: [],
        },
      };

    case "matrix":
    case "heatmap":
      return {
        ...base,
        data: {
          dataset: "pedidos",
          axis: "fechaHora",
          granularity: "hourOfDay",
          legend: "fechaHora",
          legendGranularity: "weekday",
          values: [{ field: "numPedidos", agg: "count" }],
          filters: [],
        },
      };

    case "waterfall":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [{ field: "total", agg: "sum" }],
          filters: [],
        },
      };

    case "pareto":
      return {
        ...base,
        data: {
          dataset: "platos_vendidos",
          axis: "producto",
          values: [{ field: "importe", agg: "sum" }],
          filters: [],
        },
      };

    case "radar":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [
            { field: "total", agg: "sum" },
            { field: "igv", agg: "sum" },
          ],
          filters: [],
        },
      };

    case "funnel":
      return {
        ...base,
        data: {
          dataset: "ventas",
          axis: "tipoComprobante",
          values: [{ field: "total", agg: "sum" }],
          filters: [],
        },
      };

    case "treemap":
      return {
        ...base,
        data: {
          dataset: "platos_vendidos",
          axis: "producto",
          values: [{ field: "importe", agg: "sum" }],
          filters: [],
        },
      };

    case "scatter":
      return {
        ...base,
        data: {
          dataset: "platos_vendidos",
          axis: "producto",
          values: [
            { field: "cantidad", agg: "sum", series: "x" },
            { field: "importe", agg: "sum", series: "y" },
          ],
          filters: [],
        },
      };

    default:
      return base;
  }
}

describe("Ronda D1 - Item 1: Render Real de TODOS los tipos del Registro", () => {
  const allRegistryEntries = Object.values(VISUAL_REGISTRY);
  const visibleEntries = allRegistryEntries.filter((e) => !e.hidden);

  it("Punto 7: 'slicer' está oculto en el registro y todo tipo visible TIENE un renderer asignado", () => {
    expect(VISUAL_REGISTRY.slicer.hidden).toBe(true);

    for (const entry of visibleEntries) {
      const renderer = VISUAL_RENDERERS[entry.id as keyof typeof VISUAL_RENDERERS];
      expect(
        renderer,
        `El tipo visible '${entry.id}' debe tener un renderer asignado en VISUAL_RENDERERS`
      ).toBeDefined();
    }
  });

  describe("Verificación completa: esquema Zod, whitelist y renderizado sin errores", () => {
    const failedTypes: string[] = [];

    for (const entry of visibleEntries) {
      it(`renderiza '${entry.id}' (${entry.label}) con campos reales y sin excepciones`, () => {
        try {
          const config = buildRealConfigForVisual(entry.id);

          // 1. Validación de esquema Zod
          const zodParse = widgetConfigSchema.safeParse(config);
          expect(zodParse.success, `Zod schema falló para '${entry.id}': ${JSON.stringify(zodParse.error)}`).toBe(true);

          // 2. Validación de whitelist del servicio (sin DB)
          expect(() => validateQueryConfigWhitelist(config.data)).not.toThrow();

          // 3. Render real con Testing Library
          const { container } = render(<DynamicVisual config={config} />);
          expect(container).toBeTruthy();
          expect(container.firstChild).not.toBeNull();
        } catch (err) {
          failedTypes.push(entry.id);
          throw err;
        }
      });
    }

    it("reporta 0 tipos con fallos de renderizado", () => {
      expect(failedTypes).toEqual([]);
    });
  });
});
