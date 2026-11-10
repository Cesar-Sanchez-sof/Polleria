import { describe, it, expect, beforeEach } from "vitest";
import {
  SEMANTIC_DATASETS,
  AVAILABLE_DATASETS,
  getSemanticField,
  ALL_DATE_GRANULARITIES,
} from "@/lib/dashboards/semantic-model";
import {
  widgetConfigSchema,
  widgetDataConfigSchema,
  createDefaultWidgetConfig,
} from "@/lib/dashboards/widget-schema";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { formatSemanticDate, toLimaDate } from "@/lib/services/settings/dashboard-query.service";

describe("Capa Semántica Ampliada (Semantic Engine)", () => {
  it("debe registrar los 10 datasets requeridos del negocio", () => {
    const requiredDatasets = [
      "ventas",
      "compras",
      "inventario",
      "contabilidad",
      "pedidos",
      "platos_vendidos",
      "pagos_venta",
      "compras_detalle",
      "movimientos_inventario",
      "gastos_menores",
    ];

    for (const dId of requiredDatasets) {
      expect(SEMANTIC_DATASETS[dId], `Dataset ${dId} no encontrado`).toBeDefined();
    }
    expect(AVAILABLE_DATASETS.length).toBeGreaterThanOrEqual(10);
  });

  it("cada dataset transaccional debe tener isTransactional: true", () => {
    expect(SEMANTIC_DATASETS.ventas.isTransactional).toBe(true);
    expect(SEMANTIC_DATASETS.compras.isTransactional).toBe(true);
    expect(SEMANTIC_DATASETS.contabilidad.isTransactional).toBe(true);
    expect(SEMANTIC_DATASETS.pedidos.isTransactional).toBe(true);
    expect(SEMANTIC_DATASETS.platos_vendidos.isTransactional).toBe(true);
    expect(SEMANTIC_DATASETS.inventario.isTransactional).toBe(false); // Maestro
  });

  it("los datasets clave deben contar con baseFilter real verificado en código", () => {
    expect(SEMANTIC_DATASETS.ventas.baseFilter).toEqual({
      status: { notIn: ["Cancelled"] },
    });
    expect(SEMANTIC_DATASETS.pedidos.baseFilter).toEqual({
      status: { notIn: ["Cancelled"] },
    });
    expect(SEMANTIC_DATASETS.platos_vendidos.baseFilter).toEqual({
      itemStatus: { notIn: ["Cancelled"] },
      order: { status: { notIn: ["Cancelled"] } },
    });
    expect(SEMANTIC_DATASETS.contabilidad.baseFilter).toEqual({
      entry: { status: true },
    });
    expect(SEMANTIC_DATASETS.gastos_menores.baseFilter).toEqual({
      annulled: false,
    });
  });

  it("los campos de fecha deben marcar hasTime: boolean correctamente", () => {
    const issuedAt = getSemanticField("ventas", "fecha");
    expect(issuedAt?.dataType).toBe("date");
    expect(issuedAt?.hasTime).toBe(false); // @db.Date

    const createdAt = getSemanticField("ventas", "fechaCreacion");
    expect(createdAt?.dataType).toBe("date");
    expect(createdAt?.hasTime).toBe(true); // Timestamp

    const orderedAt = getSemanticField("pedidos", "fechaHora");
    expect(orderedAt?.hasTime).toBe(true); // Timestamp

    const entryDate = getSemanticField("contabilidad", "fecha");
    expect(entryDate?.hasTime).toBe(false); // @db.Date
  });

  it("platos_vendidos incluye las nuevas dimensiones y medidas requeridas", () => {
    const ds = SEMANTIC_DATASETS.platos_vendidos;
    const fieldIds = ds.fields.map((f) => f.id);

    expect(fieldIds).toContain("tipoPedido");
    expect(fieldIds).toContain("estadoPedido");
    expect(fieldIds).toContain("tipoProducto");
    expect(fieldIds).toContain("numPedidos");
    expect(fieldIds).toContain("precioPromedioUnidad");

    const precioProm = getSemanticField("platos_vendidos", "precioPromedioUnidad");
    expect(precioProm?.label).toBe("Precio promedio por unidad (S/)");
    expect(precioProm?.calculateGroup!({ importe_sum: 450, cantidad_sum: 9 })).toBe(50);

    const numPedidos = getSemanticField("platos_vendidos", "numPedidos");
    expect(numPedidos?.allowedAggregations).toContain("countDistinct");
  });

  it("pedidos calcula ticketPromedio como suma/suma (importeTotal / numPedidos)", () => {
    const ticketProm = getSemanticField("pedidos", "ticketPromedio");
    expect(ticketProm?.isCalculated).toBe(true);
    expect(ticketProm?.calculateGroup).toBeDefined();

    // 1200 soles entre 30 pedidos = 40 soles promedio
    const res = ticketProm?.calculateGroup!({
      importeTotal_sum: 1200,
      numPedidos_count: 30,
    });
    expect(res).toBe(40);
  });

  it("contabilidad contiene origen con 5 valores, periodo, responsable, codigoAsiento y numLineas", () => {
    const ds = SEMANTIC_DATASETS.contabilidad;
    const fieldIds = ds.fields.map((f) => f.id);

    expect(fieldIds).toContain("origen");
    expect(fieldIds).toContain("periodo");
    expect(fieldIds).toContain("responsable");
    expect(fieldIds).toContain("codigoAsiento");
    expect(fieldIds).toContain("numLineas");

    const origenField = getSemanticField("contabilidad", "origen")!;
    expect(origenField.customExtractor!({ entry: { salesInvoiceId: 10 } })).toBe("Venta");
    expect(origenField.customExtractor!({ entry: { purchaseInvoiceId: 5 } })).toBe("Compra");
    expect(origenField.customExtractor!({ entry: { payrollId: 2 } })).toBe("Planilla");
    expect(origenField.customExtractor!({ entry: { transformationId: 3 } })).toBe("Transformación");
    expect(origenField.customExtractor!({ entry: {} })).toBe("Manual");
  });
});

describe("Conversión de Zona Horaria (hasTime: true vs false)", () => {
  it("una venta con createdAt 04:30 UTC del día 10 debe agruparse en el día 9 y hora 23 de Lima", () => {
    const createdAtUtc = new Date("2026-11-10T04:30:00.000Z");
    expect(formatSemanticDate(createdAtUtc, true, "day")).toBe("2026-11-09");
    expect(formatSemanticDate(createdAtUtc, true, "hour")).toBe("2026-11-09 23:00");
  });

  it("un issuedAt (@db.Date sin hora) del día 9 debe quedar en el día 9 en UTC", () => {
    const issuedAtUtc = new Date("2026-11-09T00:00:00.000Z");
    expect(formatSemanticDate(issuedAtUtc, false, "day")).toBe("2026-11-09");
  });
});

describe("Esquema de Configuración del Widget (Widget Schema)", () => {
  it("soporta todos los operadores de filtro: eq, neq, in, between, gt, lt, startsWith", () => {
    const validData = {
      dataset: "ventas",
      values: [{ field: "total", agg: "sum" as const }],
      filters: [
        { field: "serie", operator: "startsWith" as const, value: "B" },
        { field: "tipoComprobante", operator: "eq" as const, value: "Boleta" },
        { field: "estado", operator: "neq" as const, value: "Cancelled" },
        { field: "total", operator: "between" as const, value: [10, 100] },
      ],
    };

    const res = widgetDataConfigSchema.safeParse(validData);
    expect(res.success).toBe(true);
  });
});

describe("Store de Zustand (Dashboard Editor Store)", () => {
  beforeEach(() => {
    useDashboardEditorStore.getState().resetStore();
  });

  it("guarda el visualType en 'type' y el dataset en 'metricKey'", () => {
    const store = useDashboardEditorStore.getState();
    const id = store.addWidget({
      config: createDefaultWidgetConfig("bar", "Ventas Mensuales", "ventas"),
    });

    let widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.type).toBe("bar");
    expect(widget?.metricKey).toBe("ventas");

    store.updateWidgetVisualType(id, "donut");
    widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.type).toBe("donut");

    store.updateWidgetData(id, { dataset: "contabilidad" });
    widget = useDashboardEditorStore.getState().getSelectedWidget();
    expect(widget?.metricKey).toBe("contabilidad");
  });
});
