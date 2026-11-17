/**
 * E3/E5 Tests: CrossFilter store (datasetId, field, granularity, value, display, sourceWidgetId)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";

function getStore() {
  return useDashboardEditorStore.getState();
}

beforeEach(() => {
  useDashboardEditorStore.getState().resetStore();
});

describe("CrossFilter store – estado inicial", () => {
  it("crossFilters arranca en null", () => {
    expect(getStore().crossFilters).toBeNull();
  });
});

describe("CrossFilter store – setCrossFilter", () => {
  it("agrega un filtro cruzado estructurado", () => {
    getStore().setCrossFilter({
      datasetId: "ventas",
      field: "metodoPago",
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    });
    expect(getStore().crossFilters).toEqual({
      datasetId: "ventas",
      field: "metodoPago",
      granularity: undefined,
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    });
  });

  it("haciendo clic en el mismo valor lo limpia (toggle off)", () => {
    const filter = {
      datasetId: "ventas",
      field: "metodoPago",
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    };
    getStore().setCrossFilter(filter);
    expect(getStore().crossFilters).not.toBeNull();

    // Segundo clic con el mismo filtro lo quita
    getStore().setCrossFilter(filter);
    expect(getStore().crossFilters).toBeNull();
  });

  it("sobreescribe el filtro anterior si se selecciona otro valor", () => {
    getStore().setCrossFilter({
      datasetId: "ventas",
      field: "metodoPago",
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    });
    getStore().setCrossFilter({
      datasetId: "ventas",
      field: "metodoPago",
      value: "Tarjeta",
      display: "Tarjeta",
      sourceWidgetId: "w1",
    });
    expect(getStore().crossFilters?.value).toBe("Tarjeta");
  });
});

describe("CrossFilter store – clearCrossFilters", () => {
  it("limpia el filtro activo", () => {
    getStore().setCrossFilter({
      datasetId: "ventas",
      field: "metodoPago",
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    });
    getStore().clearCrossFilters();
    expect(getStore().crossFilters).toBeNull();
  });

  it("clearCrossFilters es idempotente cuando ya es null", () => {
    getStore().clearCrossFilters();
    expect(getStore().crossFilters).toBeNull();
  });
});

describe("CrossFilter store – resetStore", () => {
  it("resetStore reinicia crossFilters a null", () => {
    getStore().setCrossFilter({
      datasetId: "ventas",
      field: "metodoPago",
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    });
    getStore().resetStore();
    expect(getStore().crossFilters).toBeNull();
  });
});

describe("CrossFilter store – helper hasCrossFilters", () => {
  it("false cuando crossFilters es null", () => {
    expect(Boolean(getStore().crossFilters)).toBe(false);
  });

  it("true cuando hay un filtro activo", () => {
    getStore().setCrossFilter({
      datasetId: "ventas",
      field: "metodoPago",
      value: "Efectivo",
      display: "Efectivo",
      sourceWidgetId: "w1",
    });
    expect(Boolean(getStore().crossFilters)).toBe(true);
  });
});
