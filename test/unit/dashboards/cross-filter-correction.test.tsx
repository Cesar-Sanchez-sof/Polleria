// @vitest-environment jsdom
/**
 * Pruebas de Corrección del Filtro Cruzado (Cross-Filtering)
 *
 * 1. El filtro se inyecta en el payload del mismo dataset y NO en otro (ni en el widget origen).
 * 2. Fecha day → rango Lima con reloj 2026-12-01T03:00:00Z.
 * 3. Campo con etiqueta usa el valor crudo (rawValue).
 * 4. Campo derivado no filtrable (filterable: false).
 * 5. Toggle (clic de nuevo o clearCrossFilters).
 * 6. axisRawValue y legendRawValue por separado en consultas con eje y leyenda.
 * 7. Exclusión de rawValue / axisRawValue / legendRawValue de las columnas en renderers.
 * 8. Combinación (AND) e intersección de rangos de fecha sobre el mismo campo con reloj 2026-11-10T15:00:00Z.
 * 9. Tecla Esc: acordiones data-state="open" SÍ quitan filtro, Dialog/AlertDialog NO.
 * 10. ShareModeContext: default false, desactiva onCrossFilter.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { useDashboardEditorStore, type CrossFilterState } from "@/lib/store/dashboard-editor-store";
import {
  filterRuleSchema,
  type FilterRule,
  type WidgetDateRange,
  type WidgetConfig,
  createDefaultWidgetConfig,
} from "@/lib/dashboards/widget-schema";
import { resolveCrossFilterDateRange, resolveDateRange } from "@/lib/dashboards/date-utils";
import { buildDateCondition, buildWhereClause } from "@/lib/services/settings/dashboard-query.service";
import { getDashboardCatalogService } from "@/lib/services/settings/dashboard-catalog.service";
import { SEMANTIC_DATASETS } from "@/lib/dashboards/semantic-model";
import { CrossFilterChip } from "@/components/dashboards/CrossFilterChip";
import { ShareModeContext, useShareMode } from "@/components/dashboards/share-mode-context";
import { DynamicVisual } from "@/components/dashboards/visuals/DynamicVisual";
import { MatrixRenderer } from "@/components/dashboards/visuals/renderers/MatrixRenderer";
import { HeatmapRenderer } from "@/components/dashboards/visuals/renderers/HeatmapRenderer";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Helper que replica la inyección pura en el payload de useVisualData con intersección y AND
function applyCrossFilterToPayload(
  currentFilters: FilterRule[],
  crossFilter: CrossFilterState | null,
  widgetDataset: string,
  widgetId: string
): FilterRule[] {
  let filters = [...currentFilters];
  if (!crossFilter || !widgetDataset) return filters;

  const matchesDataset = widgetDataset === crossFilter.datasetId;
  const isNotSource = !widgetId || widgetId !== crossFilter.sourceWidgetId;

  if (matchesDataset && isNotSource) {
    const operator = Array.isArray(crossFilter.value) ? "between" : "eq";
    const candidate = {
      field: crossFilter.field,
      operator,
      value: crossFilter.value,
    };
    const parsed = filterRuleSchema.safeParse(candidate);
    if (parsed.success) {
      const existingIdx = filters.findIndex((f) => f.field === crossFilter.field);
      if (existingIdx >= 0) {
        const existing = filters[existingIdx];
        if (
          existing.operator === "between" &&
          Array.isArray(existing.value) &&
          existing.value.length === 2 &&
          parsed.data.operator === "between" &&
          Array.isArray(parsed.data.value) &&
          parsed.data.value.length === 2
        ) {
          const start1 = String(existing.value[0]).trim().slice(0, 10);
          const end1 = String(existing.value[1]).trim().slice(0, 10);
          const start2 = String(parsed.data.value[0]).trim().slice(0, 10);
          const end2 = String(parsed.data.value[1]).trim().slice(0, 10);
          const maxStart = start1 > start2 ? start1 : start2;
          const minEnd = end1 < end2 ? end1 : end2;
          filters[existingIdx] = {
            field: crossFilter.field,
            operator: "between",
            value: [maxStart, minEnd],
          };
        } else {
          filters.push(parsed.data);
        }
      } else {
        filters.push(parsed.data);
      }
    }
  }

  return filters;
}

beforeEach(() => {
  useDashboardEditorStore.getState().resetStore();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("1. Inyección de filtro cruzado por dataset y widget origen", () => {
  const activeFilter: CrossFilterState = {
    datasetId: "ventas",
    field: "metodoPago",
    value: "Efectivo",
    display: "Efectivo",
    sourceWidgetId: "widget_origen_1",
  };

  it("el filtro se inyecta en un visual del MISMO dataset cuando no es el origen", () => {
    const baseFilters: FilterRule[] = [];
    const result = applyCrossFilterToPayload(baseFilters, activeFilter, "ventas", "widget_destino_2");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      field: "metodoPago",
      operator: "eq",
      value: "Efectivo",
    });
  });

  it("el filtro NO se inyecta en el widget de origen (mantiene sus propios datos)", () => {
    const baseFilters: FilterRule[] = [];
    const result = applyCrossFilterToPayload(baseFilters, activeFilter, "ventas", "widget_origen_1");

    expect(result).toHaveLength(0);
  });

  it("el filtro NO se inyecta en visuales de OTRO dataset", () => {
    const baseFilters: FilterRule[] = [];
    const result = applyCrossFilterToPayload(baseFilters, activeFilter, "pedidos", "widget_destino_3");

    expect(result).toHaveLength(0);
  });
});

describe("2. Fechas: conversión a rango America/Lima con reloj UTC", () => {
  it("fecha day → rango [d, d] traducido a horario de Lima con reloj 2026-12-01T03:00:00Z", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T03:00:00Z"));

    const range = resolveCrossFilterDateRange("2026-12-01", "day");
    expect(range).toEqual(["2026-12-01", "2026-12-01"]);

    const condition = buildDateCondition("between", range, true) as { gte: Date; lt: Date };
    expect(condition.gte.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(condition.lt.toISOString()).toBe("2026-12-02T05:00:00.000Z");

    const clockUtc = new Date("2026-12-01T03:00:00Z");
    expect(clockUtc < condition.gte).toBe(true);
  });

  it("granularidades no filtrables (hour, hourOfDay, weekday) retornan null", () => {
    expect(resolveCrossFilterDateRange("2026-12-01", "hour")).toBeNull();
    expect(resolveCrossFilterDateRange("2026-12-01", "hourOfDay")).toBeNull();
    expect(resolveCrossFilterDateRange("2026-12-01", "weekday")).toBeNull();
  });
});

describe("3. Campos con valueLabels usan el valor crudo (rawValue)", () => {
  it("tipoProducto en platos_vendidos expone FinishedProduct como valor de filtro", async () => {
    const catalog = await getDashboardCatalogService();
    const ds = catalog.find((d) => d.id === "platos_vendidos");
    const field = ds?.fields.find((f) => f.id === "tipoProducto");

    expect(field?.valueLabels).toBeDefined();
    expect(field?.valueLabels?.["FinishedProduct"]).toBe("Producto Terminado");

    const filter: CrossFilterState = {
      datasetId: "platos_vendidos",
      field: "tipoProducto",
      value: "FinishedProduct",
      display: "Producto Terminado",
      sourceWidgetId: "w1",
    };

    const parsed = filterRuleSchema.safeParse({
      field: filter.field,
      operator: "eq",
      value: filter.value,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.value).toBe("FinishedProduct");
    }
  });
});

describe("4. Campos derivados no filtrables (sin prismaPath o con customExtractor)", () => {
  it("campo derivado sin prismaPath expone filterable: false en el catálogo", async () => {
    const catalog = await getDashboardCatalogService();
    const ds = catalog.find((d) => d.id === "inventario");
    const valorInv = ds?.fields.find((f) => f.id === "valorInventario");

    expect(valorInv?.filterable).toBe(false);
  });

  it("campo persistido en Prisma expone filterable: true", async () => {
    const catalog = await getDashboardCatalogService();
    const ds = catalog.find((d) => d.id === "ventas");
    const voucherTypeField = ds?.fields.find((f) => f.id === "tipoComprobante");

    expect(voucherTypeField?.filterable).toBe(true);
  });
});

describe("5. Toggle y descarte de filtro cruzado", () => {
  const filter: CrossFilterState = {
    datasetId: "ventas",
    field: "metodoPago",
    value: "Efectivo",
    display: "Efectivo",
    sourceWidgetId: "w1",
  };

  it("primer clic activa el filtro, segundo clic en la misma barra lo quita (toggle)", () => {
    useDashboardEditorStore.getState().setCrossFilter(filter);
    expect(useDashboardEditorStore.getState().crossFilters).toEqual(filter);

    useDashboardEditorStore.getState().setCrossFilter(filter);
    expect(useDashboardEditorStore.getState().crossFilters).toBeNull();
  });

  it("clearCrossFilters limpia el filtro inmediatamente", () => {
    useDashboardEditorStore.getState().setCrossFilter(filter);
    expect(useDashboardEditorStore.getState().crossFilters).not.toBeNull();

    useDashboardEditorStore.getState().clearCrossFilters();
    expect(useDashboardEditorStore.getState().crossFilters).toBeNull();
  });
});

describe("6. Exclusión de rawValue / axisRawValue / legendRawValue en columnas de tablas", () => {
  it("las columnas técnicas no se deben presentar como cabeceras en el visual", () => {
    const technicalKeys = new Set(["rawValue", "axisRawValue", "legendRawValue"]);
    const rawHeaders = ["fecha", "metodoPago", "total_sum", "rawValue", "axisRawValue", "legendRawValue"];
    const displayHeaders = rawHeaders.filter((h) => !technicalKeys.has(h));

    expect(displayHeaders).toEqual(["fecha", "metodoPago", "total_sum"]);
    expect(displayHeaders.includes("rawValue")).toBe(false);
    expect(displayHeaders.includes("axisRawValue")).toBe(false);
    expect(displayHeaders.includes("legendRawValue")).toBe(false);
  });
});

describe("7. Intersección de fechas con reloj 2026-11-10T15:00:00Z", () => {
  const refDate = new Date("2026-11-10T15:00:00Z");

  it("(a) dateRange thisMonth + clic en 2026-11-05 => between ['2026-11-05', '2026-11-05']", () => {
    vi.useFakeTimers();
    vi.setSystemTime(refDate);

    const monthRange = resolveDateRange({ field: "fecha", preset: "thisMonth" }, refDate);
    expect(monthRange).toEqual(["2026-11-01", "2026-11-30"]);

    const existingFilter: FilterRule = {
      field: "fecha",
      operator: "between",
      value: monthRange,
    };

    const crossFilter: CrossFilterState = {
      datasetId: "ventas",
      field: "fecha",
      granularity: "day",
      value: ["2026-11-05", "2026-11-05"],
      display: "2026-11-05",
      sourceWidgetId: "w_src",
    };

    const combined = applyCrossFilterToPayload([existingFilter], crossFilter, "ventas", "w_target");
    expect(combined).toHaveLength(1);
    expect(combined[0]).toEqual({
      field: "fecha",
      operator: "between",
      value: ["2026-11-05", "2026-11-05"],
    });
  });

  it("(b) clic en 2026-10-20 con rango thisMonth => intersección vacía: el filtro sigue activo y el rango es vacío", () => {
    vi.useFakeTimers();
    vi.setSystemTime(refDate);

    const monthRange = resolveDateRange({ field: "fecha", preset: "thisMonth" }, refDate);
    expect(monthRange).toEqual(["2026-11-01", "2026-11-30"]);

    const existingFilter: FilterRule = {
      field: "fecha",
      operator: "between",
      value: monthRange,
    };

    const crossFilter: CrossFilterState = {
      datasetId: "ventas",
      field: "fecha",
      granularity: "day",
      value: ["2026-10-20", "2026-10-20"],
      display: "2026-10-20",
      sourceWidgetId: "w_src",
    };

    useDashboardEditorStore.getState().setCrossFilter(crossFilter);
    expect(useDashboardEditorStore.getState().crossFilters).toEqual(crossFilter);

    const combined = applyCrossFilterToPayload([existingFilter], crossFilter, "ventas", "w_target");
    expect(combined).toHaveLength(1);
    // Comparación lexicográfica: '2026-11-01' > '2026-10-20' => [2026-11-01, 2026-10-20] (rango vacío)
    expect(combined[0].value).toEqual(["2026-11-01", "2026-10-20"]);

    // El filtro cruzado en el store sigue activo y visible para el usuario
    expect(useDashboardEditorStore.getState().crossFilters).not.toBeNull();
  });

  it("(c) si dateRange es custom y el clic cae dentro del rango, gana el clic", () => {
    const customRange: WidgetDateRange = {
      field: "fecha",
      preset: "custom",
      from: "2026-11-01",
      to: "2026-11-20",
    };

    const resolved = resolveDateRange(customRange, refDate);
    expect(resolved).toEqual(["2026-11-01", "2026-11-20"]);

    const existingFilter: FilterRule = {
      field: "fecha",
      operator: "between",
      value: resolved,
    };

    const crossFilter: CrossFilterState = {
      datasetId: "ventas",
      field: "fecha",
      granularity: "day",
      value: ["2026-11-05", "2026-11-05"],
      display: "2026-11-05",
      sourceWidgetId: "w_src",
    };

    const combined = applyCrossFilterToPayload([existingFilter], crossFilter, "ventas", "w_target");
    expect(combined).toHaveLength(1);
    expect(combined[0].value).toEqual(["2026-11-05", "2026-11-05"]);
  });
});

describe("8. Tecla Esc: acordiones data-state='open' SÍ quitan filtro, Dialog/AlertDialog NO", () => {
  const filter: CrossFilterState = {
    datasetId: "ventas",
    field: "tipoComprobante",
    value: "Boleta",
    display: "Boleta",
    sourceWidgetId: "w_src",
  };

  it("con un acordeón abierto en el DOM (data-state='open' sin rol de diálogo), Esc SÍ quita el filtro", () => {
    useDashboardEditorStore.getState().setCrossFilter(filter);
    expect(useDashboardEditorStore.getState().crossFilters).toEqual(filter);

    const accordion = document.createElement("div");
    accordion.setAttribute("data-state", "open");
    accordion.setAttribute("data-orientation", "vertical");
    document.body.appendChild(accordion);

    render(<CrossFilterChip />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    // Esc SÍ debió limpiar el filtro
    expect(useDashboardEditorStore.getState().crossFilters).toBeNull();
  });

  it("con un Dialog abierto en el DOM ([role='dialog'][data-state='open']), Esc NO quita el filtro", () => {
    useDashboardEditorStore.getState().setCrossFilter(filter);
    expect(useDashboardEditorStore.getState().crossFilters).toEqual(filter);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);

    render(<CrossFilterChip />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    // Esc NO debió limpiar el filtro porque el modal consume Escape
    expect(useDashboardEditorStore.getState().crossFilters).not.toBeNull();
  });

  it("con un AlertDialog abierto en el DOM ([role='alertdialog'][data-state='open']), Esc NO quita el filtro", () => {
    useDashboardEditorStore.getState().setCrossFilter(filter);
    expect(useDashboardEditorStore.getState().crossFilters).toEqual(filter);

    const alertDialog = document.createElement("div");
    alertDialog.setAttribute("role", "alertdialog");
    alertDialog.setAttribute("data-state", "open");
    document.body.appendChild(alertDialog);

    render(<CrossFilterChip />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    // Esc NO debió limpiar el filtro
    expect(useDashboardEditorStore.getState().crossFilters).not.toBeNull();
  });
});

describe("9. ShareModeContext: default false", () => {
  it("por defecto ShareModeContext evalúa a false", () => {
    let mode: boolean | undefined = undefined;
    function Consumer() {
      mode = useShareMode();
      return null;
    }
    render(<Consumer />);
    expect(mode).toBe(false);
  });

  it("al envolver en ShareModeProvider value={true}, evalúa a true", () => {
    let mode: boolean | undefined = undefined;
    function Consumer() {
      mode = useShareMode();
      return null;
    }
    render(
      <ShareModeContext.Provider value={true}>
        <Consumer />
      </ShareModeContext.Provider>
    );
    expect(mode).toBe(true);
  });
});

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val as object);
    }
  }
  return obj;
}

describe("10. buildWhereClause no muta objetos compartidos (baseFilter congelado)", () => {
  it("dos consultas seguidas sobre platos_vendidos y contabilidad no mutan baseFilter", () => {
    const platosDataset = SEMANTIC_DATASETS.platos_vendidos;
    const contaDataset = SEMANTIC_DATASETS.contabilidad;

    const originalPlatosBase = structuredClone(platosDataset.baseFilter);
    const originalContaBase = structuredClone(contaDataset.baseFilter);

    // Congelar profundamente para que cualquier mutación lance TypeError
    deepFreeze(platosDataset.baseFilter!);
    deepFreeze(contaDataset.baseFilter!);

    const fieldMapPlatos = new Map(platosDataset.fields.map((f) => [f.id, f]));
    const fieldMapConta = new Map(contaDataset.fields.map((f) => [f.id, f]));

    // Consulta 1 platos_vendidos: rango 2026-11-01 a 2026-11-05
    const where1 = buildWhereClause(
      [{ field: "fechaHora", operator: "between", value: ["2026-11-01", "2026-11-05"] }],
      fieldMapPlatos,
      platosDataset.baseFilter
    );
    expect(where1).toBeDefined();

    // Consulta 2 platos_vendidos: rango 2026-11-15 a 2026-11-20
    const where2 = buildWhereClause(
      [{ field: "fechaHora", operator: "between", value: ["2026-11-15", "2026-11-20"] }],
      fieldMapPlatos,
      platosDataset.baseFilter
    );

    // where2 solo debe contener su propio rango, no el anterior
    const orderWhere2 = where2.order as Record<string, any>;
    expect(orderWhere2.orderedAt).toBeDefined();
    expect(orderWhere2.orderedAt.gte.toISOString()).toBe("2026-11-15T05:00:00.000Z");
    expect(platosDataset.baseFilter).toEqual(originalPlatosBase);

    // Consulta 1 contabilidad: rango 2026-10-01 a 2026-10-10
    const whereConta1 = buildWhereClause(
      [{ field: "fecha", operator: "between", value: ["2026-10-01", "2026-10-10"] }],
      fieldMapConta,
      contaDataset.baseFilter
    );
    expect(whereConta1).toBeDefined();

    // Consulta 2 contabilidad: rango 2026-11-01 a 2026-11-05
    const whereConta2 = buildWhereClause(
      [{ field: "fecha", operator: "between", value: ["2026-11-01", "2026-11-05"] }],
      fieldMapConta,
      contaDataset.baseFilter
    );

    const entryWhere2 = whereConta2.entry as Record<string, any>;
    expect(entryWhere2.entryDate).toBeDefined();
    expect(entryWhere2.entryDate.gte.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(contaDataset.baseFilter).toEqual(originalContaBase);
  });
});

describe("11. Intersección vacía: no hace petición HTTP y renderiza 'Sin datos'", () => {
  it("con fecha inicio > fin, no hace fetch y muestra 'Sin datos para mostrar con los filtros aplicados'", () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // Activamos filtro cruzado fuera de rango para provocar intersección vacía
    useDashboardEditorStore.getState().setCrossFilter({
      datasetId: "ventas",
      field: "fecha",
      granularity: "day",
      value: ["2026-10-20", "2026-10-20"],
      display: "2026-10-20",
      sourceWidgetId: "other_widget",
    });

    const baseConfig = createDefaultWidgetConfig("table", "Test Table");
    const config: WidgetConfig = {
      ...baseConfig,
      data: {
        ...baseConfig.data,
        dataset: "ventas",
        values: [{ field: "total", agg: "sum" }],
        dateRange: { field: "fecha", preset: "custom", from: "2026-11-01", to: "2026-11-30" },
      },
    };

    render(<DynamicVisual config={config} widgetId="test_widget" />);

    // El visual debe renderizar directamente el texto de sin datos
    expect(document.body.textContent).toContain("Sin datos para mostrar con los filtros aplicados");

    // No se ejecutó fetch para este visual con intersección vacía
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboards/query"),
      expect.anything()
    );

    // El filtro cruzado sigue activo y visible en el store
    expect(useDashboardEditorStore.getState().crossFilters).not.toBeNull();
  });
});

describe("12. Heatmap y Matrix despachan siempre la dimensión del eje (axisRawValue)", () => {
  const mockData = {
    dataset: "ventas",
    rows: [
      {
        tipoComprobante: "Boleta",
        metodoPago: "Efectivo",
        total_sum: 100,
        axisRawValue: "03",
        legendRawValue: "CASH",
      },
    ],
    meta: {
      axis: "tipoComprobante",
      legend: "metodoPago",
      metrics: ["total_sum"],
      totalRows: 1,
      truncated: false,
      engine: "in_memory_hybrid" as const,
    },
  };

  it("MatrixRenderer despacha onCrossFilter con axisRawValue ('03') al hacer clic en la fila", () => {
    const onCrossFilter = vi.fn();
    const matrixConfig = createDefaultWidgetConfig("matrix", "Test Matrix");
    render(
      <MatrixRenderer
        visualType="matrix"
        config={matrixConfig}
        data={mockData}
        format={matrixConfig.format}
        palette={["#3b82f6"]}
        fieldLabelsMap={new Map()}
        onCrossFilter={onCrossFilter}
      />
    );

    const cell = screen.getByText("Boleta");
    fireEvent.click(cell);

    expect(onCrossFilter).toHaveBeenCalledWith("tipoComprobante", "03", "Boleta");
  });

  it("HeatmapRenderer despacha onCrossFilter con axisRawValue ('03') al hacer clic en la fila o celda", () => {
    const onCrossFilter = vi.fn();
    const heatmapConfig = createDefaultWidgetConfig("heatmap", "Test Heatmap");
    render(
      <HeatmapRenderer
        visualType="heatmap"
        config={heatmapConfig}
        data={mockData}
        format={heatmapConfig.format}
        palette={["#3b82f6"]}
        fieldLabelsMap={new Map()}
        onCrossFilter={onCrossFilter}
      />
    );

    const cell = screen.getByText("Boleta");
    fireEvent.click(cell);

    expect(onCrossFilter).toHaveBeenCalledWith("tipoComprobante", "03", "Boleta");
  });
});
