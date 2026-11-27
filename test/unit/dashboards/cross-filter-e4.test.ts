/**
 * E4 Tests: Cross-Filter field compatibility in useVisualData logic
 * Tests the pure logic of filtering crossFilter fields against a dataset catalog.
 */
import { describe, it, expect } from "vitest";
import type { CatalogDataset } from "@/lib/hooks/use-visual-data";

// ---------------------------------------------------------------------------
// Pure helper that replicates the useVisualData cross-filter injection logic
// ---------------------------------------------------------------------------

type Filter = {
  field: string;
  operator: string;
  value: string | number | boolean | (string | number)[];
};

function buildFiltersWithCrossFilter(
  baseFilters: Filter[],
  crossFilters: Record<string, unknown> | null,
  dataset: string | undefined,
  catalog: CatalogDataset[]
): Filter[] {
  let filters = [...baseFilters];
  if (!crossFilters || !dataset) return filters;

  const datasetMeta = catalog.find((ds) => ds.id === dataset);
  const datasetFieldIds = new Set(datasetMeta?.fields.map((f) => f.id) ?? []);

  for (const [field, value] of Object.entries(crossFilters)) {
    // If catalog is loaded and field doesn't exist → skip
    if (datasetMeta && !datasetFieldIds.has(field)) continue;
    filters = filters.filter((f) => f.field !== field);
    filters.push({
      field,
      operator: "eq",
      value: value as string | number | boolean | (string | number)[],
    });
  }
  return filters;
}

function evaluateCompatibility(
  crossFilters: Record<string, unknown> | null,
  dataset: string | undefined,
  catalog: CatalogDataset[]
): { hasIncompatibleCrossFilter: boolean; hasCrossFilterApplied: boolean } {
  if (!crossFilters || !dataset) {
    return { hasIncompatibleCrossFilter: false, hasCrossFilterApplied: false };
  }
  const datasetMeta = catalog.find((ds) => ds.id === dataset);
  if (!datasetMeta) return { hasIncompatibleCrossFilter: false, hasCrossFilterApplied: false };

  const fieldIds = new Set(datasetMeta.fields.map((f) => f.id));
  const filterFields = Object.keys(crossFilters);

  return {
    hasIncompatibleCrossFilter: filterFields.length > 0 && filterFields.every((f) => !fieldIds.has(f)),
    hasCrossFilterApplied: filterFields.some((f) => fieldIds.has(f)),
  };
}

// ---------------------------------------------------------------------------
// Catalog mock
// ---------------------------------------------------------------------------
const mockCatalog: CatalogDataset[] = [
  {
    id: "ventas",
    label: "Ventas",
    description: "Dataset de ventas",
    isTransactional: true,
    fields: [
      { id: "metodoPago", label: "Método de Pago", kind: "dimension", dataType: "string" },
      { id: "total", label: "Total", kind: "measure", dataType: "number" },
      { id: "fecha", label: "Fecha", kind: "dimension", dataType: "date" },
    ],
  },
  {
    id: "comprobantes",
    label: "Comprobantes",
    description: "Dataset de comprobantes",
    isTransactional: true,
    fields: [
      { id: "tipoComprobante", label: "Tipo Comprobante", kind: "dimension", dataType: "string" },
      { id: "monto", label: "Monto", kind: "measure", dataType: "number" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tests: buildFiltersWithCrossFilter
// ---------------------------------------------------------------------------
describe("Cross-Filter field validation – buildFiltersWithCrossFilter", () => {
  it("inyecta el filtro si el campo existe en el dataset", () => {
    const result = buildFiltersWithCrossFilter(
      [],
      { metodoPago: "Efectivo" },
      "ventas",
      mockCatalog
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ field: "metodoPago", operator: "eq", value: "Efectivo" });
  });

  it("omite el filtro si el campo NO existe en el dataset (evita error visual)", () => {
    const result = buildFiltersWithCrossFilter(
      [],
      { tipoComprobante: "Boleta" }, // campo del dataset 'comprobantes', no de 'ventas'
      "ventas",
      mockCatalog
    );
    expect(result).toHaveLength(0);
  });

  it("no omite filtros si el catálogo aún no se cargó (dataset no encontrado)", () => {
    const result = buildFiltersWithCrossFilter(
      [],
      { tipoComprobante: "Boleta" },
      "ventas",
      [] // catálogo vacío = no cargado aún
    );
    // Sin catálogo no se puede validar → pasa todos los filtros
    expect(result).toHaveLength(1);
  });

  it("inyecta solo los campos compatibles cuando hay múltiples filtros", () => {
    const result = buildFiltersWithCrossFilter(
      [],
      { metodoPago: "Efectivo", tipoComprobante: "Boleta" },
      "ventas",
      mockCatalog
    );
    // 'metodoPago' existe en ventas, 'tipoComprobante' no
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("metodoPago");
  });

  it("devuelve null crossFilters sin modificar los filtros base", () => {
    const base: Filter[] = [{ field: "fecha", operator: "between", value: ["2024-01-01", "2024-12-31"] }];
    const result = buildFiltersWithCrossFilter(base, null, "ventas", mockCatalog);
    expect(result).toEqual(base);
  });
});

// ---------------------------------------------------------------------------
// Tests: evaluateCompatibility
// ---------------------------------------------------------------------------
describe("Cross-Filter compatibility indicators", () => {
  it("hasIncompatibleCrossFilter = true cuando ningún campo del filtro existe en el dataset", () => {
    const { hasIncompatibleCrossFilter, hasCrossFilterApplied } = evaluateCompatibility(
      { tipoComprobante: "Boleta" },
      "ventas",
      mockCatalog
    );
    expect(hasIncompatibleCrossFilter).toBe(true);
    expect(hasCrossFilterApplied).toBe(false);
  });

  it("hasCrossFilterApplied = true cuando al menos un campo del filtro existe", () => {
    const { hasIncompatibleCrossFilter, hasCrossFilterApplied } = evaluateCompatibility(
      { metodoPago: "Efectivo" },
      "ventas",
      mockCatalog
    );
    expect(hasIncompatibleCrossFilter).toBe(false);
    expect(hasCrossFilterApplied).toBe(true);
  });

  it("ambas = false cuando crossFilters es null", () => {
    const result = evaluateCompatibility(null, "ventas", mockCatalog);
    expect(result.hasIncompatibleCrossFilter).toBe(false);
    expect(result.hasCrossFilterApplied).toBe(false);
  });

  it("ambas = false cuando el catálogo no tiene el dataset (aún no cargado)", () => {
    const result = evaluateCompatibility({ metodoPago: "Efectivo" }, "ventas", []);
    expect(result.hasIncompatibleCrossFilter).toBe(false);
    expect(result.hasCrossFilterApplied).toBe(false);
  });
});
