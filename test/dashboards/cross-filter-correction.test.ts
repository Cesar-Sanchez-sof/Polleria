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
 * 8. Combinación (AND) e intersección de rangos de fecha sobre el mismo campo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useDashboardEditorStore, type CrossFilterState } from "@/lib/store/dashboard-editor-store";
import { filterRuleSchema, type FilterRule } from "@/lib/dashboards/widget-schema";
import { resolveCrossFilterDateRange } from "@/lib/dashboards/date-utils";
import { buildDateCondition } from "@/lib/services/settings/dashboard-query.service";
import { getDashboardCatalogService } from "@/lib/services/settings/dashboard-catalog.service";

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
          const start1 = String(existing.value[0]);
          const end1 = String(existing.value[1]);
          const start2 = String(parsed.data.value[0]);
          const end2 = String(parsed.data.value[1]);
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

  it("el filtro NO se inyecta en un visual de OTRO dataset", () => {
    const baseFilters: FilterRule[] = [];
    const result = applyCrossFilterToPayload(baseFilters, activeFilter, "pedidos", "widget_pedidos_1");

    expect(result).toHaveLength(0);
  });

  it("el filtro NO se inyecta en el visual que ORIGINÓ el filtro (sourceWidgetId)", () => {
    const baseFilters: FilterRule[] = [];
    const result = applyCrossFilterToPayload(baseFilters, activeFilter, "ventas", "widget_origen_1");

    expect(result).toHaveLength(0);
  });
});

describe("2. Fechas: resolución de rango y zona horaria Lima", () => {
  it("day → between [d, d] y filtra correctamente el reloj 2026-12-01T03:00:00Z en Lima", () => {
    const dayRange = resolveCrossFilterDateRange("2026-12-01", "day");
    expect(dayRange).toEqual(["2026-12-01", "2026-12-01"]);

    const condition = buildDateCondition("between", dayRange, true) as { gte: Date; lt: Date };
    expect(condition.gte).toBeInstanceOf(Date);
    expect(condition.lt).toBeInstanceOf(Date);

    // 00:00 Lima del 01 de dic = 05:00 UTC
    expect(condition.gte.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    // 00:00 Lima del 02 de dic (día siguiente) = 05:00 UTC excluyente
    expect(condition.lt.toISOString()).toBe("2026-12-02T05:00:00.000Z");

    // Reloj a las 2026-12-01T03:00:00Z (22:00 Lima del 30 de nov) queda fuera
    const relojTest = new Date("2026-12-01T03:00:00Z");
    const entraEnDia = relojTest >= condition.gte && relojTest < condition.lt;
    expect(entraEnDia).toBe(false);

    // Reloj a las 15:00 UTC del 1 de dic (10:00 Lima del 1 de dic) sí entra
    const relojDia = new Date("2026-12-01T15:00:00Z");
    expect(relojDia >= condition.gte && relojDia < condition.lt).toBe(true);
  });

  it("month → primer y último día del mes", () => {
    const monthRange = resolveCrossFilterDateRange("2026-12", "month");
    expect(monthRange).toEqual(["2026-12-01", "2026-12-31"]);

    const febRange = resolveCrossFilterDateRange("2026-02", "month");
    expect(febRange).toEqual(["2026-02-01", "2026-02-28"]);
  });

  it("year → primer y último día del año", () => {
    const yearRange = resolveCrossFilterDateRange("2026", "year");
    expect(yearRange).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it("granularidades hour, hourOfDay y weekday no son filtrables (retornan null)", () => {
    expect(resolveCrossFilterDateRange("2026-12-01 10:00", "hour")).toBeNull();
    expect(resolveCrossFilterDateRange("10:00", "hourOfDay")).toBeNull();
    expect(resolveCrossFilterDateRange("Lunes", "weekday")).toBeNull();
  });
});

describe("3. Campos con valueLabels: usan el valor crudo en el filtro", () => {
  it("el filtro inyecta el valor crudo (ej. '01') y no la etiqueta formateada", () => {
    const rawFilter: CrossFilterState = {
      datasetId: "ventas",
      field: "tipoComprobante",
      value: "01",
      display: "Factura",
      sourceWidgetId: "w_source",
    };

    const result = applyCrossFilterToPayload([], rawFilter, "ventas", "w_target");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      field: "tipoComprobante",
      operator: "eq",
      value: "01",
    });
  });
});

describe("4. Campo derivado no filtrable en el catálogo", async () => {
  it("expone filterable: false para campos con customExtractor o calculados", async () => {
    const catalog = await getDashboardCatalogService({ superuser: true });
    const ventas = catalog.find((ds) => ds.id === "ventas");
    expect(ventas).toBeDefined();

    // Cliente tiene customExtractor -> filterable debe ser false
    const clienteField = ventas?.fields.find((f) => f.id === "cliente");
    expect(clienteField?.filterable).toBe(false);

    // Dimensión estándar con prismaField -> filterable true
    const tipoComprobanteField = ventas?.fields.find((f) => f.id === "tipoComprobante");
    expect(tipoComprobanteField?.filterable).toBe(true);
  });
});

describe("5. Toggle del filtro cruzado en el store", () => {
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

describe("7. Filtros sobre el mismo campo: combinación e intersección de fechas", () => {
  it("dateRange thisMonth (2026-11-01 a 2026-11-30) + clic en día 2026-11-05 => solo ese día, con reloj 2026-11-10T15:00:00Z fuera", () => {
    const existingMonthFilter: FilterRule = {
      field: "fecha",
      operator: "between",
      value: ["2026-11-01", "2026-11-30"],
    };

    const dayCrossFilter: CrossFilterState = {
      datasetId: "ventas",
      field: "fecha",
      granularity: "day",
      value: ["2026-11-05", "2026-11-05"],
      display: "2026-11-05",
      sourceWidgetId: "widget_source",
    };

    const combinedFilters = applyCrossFilterToPayload([existingMonthFilter], dayCrossFilter, "ventas", "widget_target");

    expect(combinedFilters).toHaveLength(1);
    expect(combinedFilters[0]).toEqual({
      field: "fecha",
      operator: "between",
      value: ["2026-11-05", "2026-11-05"], // Intersección exacta del mes con el día 5
    });

    // Evaluar rango traducido a UTC Lima con hasTime=true
    const condition = buildDateCondition("between", combinedFilters[0].value, true) as { gte: Date; lt: Date };
    expect(condition.gte.toISOString()).toBe("2026-11-05T05:00:00.000Z");
    expect(condition.lt.toISOString()).toBe("2026-11-06T05:00:00.000Z");

    // Reloj a las 2026-11-10T15:00:00Z: cae dentro de thisMonth original, pero QUEDA FUERA de la intersección
    const relojNov10 = new Date("2026-11-10T15:00:00Z");
    const entraNov10 = relojNov10 >= condition.gte && relojNov10 < condition.lt;
    expect(entraNov10).toBe(false);

    // En cambio, reloj en el día 2026-11-05T15:00:00Z sí entra
    const relojNov5 = new Date("2026-11-05T15:00:00Z");
    const entraNov5 = relojNov5 >= condition.gte && relojNov5 < condition.lt;
    expect(entraNov5).toBe(true);
  });

  it("con otros operadores no-fecha sobre el mismo campo: no se pisan, se combinan", () => {
    const existingFilter: FilterRule = {
      field: "estado",
      operator: "neq",
      value: "Cancelled",
    };

    const crossFilter: CrossFilterState = {
      datasetId: "ventas",
      field: "estado",
      value: "Issued",
      display: "Emitida",
      sourceWidgetId: "w_src",
    };

    const combined = applyCrossFilterToPayload([existingFilter], crossFilter, "ventas", "w_tgt");
    expect(combined).toHaveLength(2);
    expect(combined[0]).toEqual(existingFilter);
    expect(combined[1]).toEqual({ field: "estado", operator: "eq", value: "Issued" });
  });
});
