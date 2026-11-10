import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeDashboardQueryService,
  formatSemanticDate,
} from "@/lib/services/settings/dashboard-query.service";
import { POST } from "@/app/api/dashboards/query/route";
import { NextRequest } from "next/server";

// Mock de Prisma
const aggregateMock = vi.fn();
const groupByMock = vi.fn();
const findManyMock = vi.fn();
const countMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesInvoice: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
    purchaseInvoice: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
    product: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
    journalEntryDetail: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
    salesOrder: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
    orderItem: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
    purchaseOrderItem: {
      aggregate: (...args: unknown[]) => aggregateMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

// Mock de autenticación y permisos RBAC
const permissionsForUserMock = vi.fn().mockResolvedValue({
  superuser: true,
  codes: ["ventas.ver", "asientos.ver", "compras.ver", "inventario.ver", "pedidos.ver", "caja.ver"],
});
vi.mock("@/lib/auth/permissions", () => ({
  authorize: vi.fn().mockResolvedValue({ ok: true, session: { userId: 1, role: "admin" } }),
  permissionsForUser: (...args: unknown[]) => permissionsForUserMock(...args),
  hasPermission: (access: { superuser: boolean; codes: string[] } | undefined, code: string) =>
    Boolean(access?.superuser || access?.codes?.includes(code)),
}));

describe("Motor Analítico y API de Consulta Genérica (Power BI Engine)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countMock.mockResolvedValue(10);
  });

  it("verifica requiredPermission y deniega acceso si el usuario no tiene el permiso del dataset", async () => {
    permissionsForUserMock.mockResolvedValueOnce({
      superuser: false,
      codes: ["ventas.ver"],
    });

    await expect(
      executeDashboardQueryService(
        {
          dataset: "contabilidad",
          values: [{ field: "debe", agg: "sum" }],
        },
        { userId: 2, superuser: false }
      )
    ).rejects.toThrow(/Permiso insuficiente para consultar el dataset 'contabilidad'/);
  });

  it("rechaza filtros con campos que no pertenezcan al whitelist", async () => {
    await expect(
      executeDashboardQueryService({
        dataset: "ventas",
        values: [{ field: "total", agg: "sum" }],
        filters: [{ field: "campo_inyeccion", operator: "eq", value: "test" }],
      })
    ).rejects.toThrow(/Campo de filtro no permitido en la whitelist/);
  });

  it("rechaza ordenamiento por campos fuera del whitelist", async () => {
    await expect(
      executeDashboardQueryService({
        dataset: "ventas",
        values: [{ field: "total", agg: "sum" }],
        sort: { by: "contrasena", dir: "asc" },
      })
    ).rejects.toThrow(/Campo de ordenamiento no permitido en la whitelist/);
  });

  it("exige filtro de fechas para datasets transaccionales en motor en memoria", async () => {
    await expect(
      executeDashboardQueryService({
        dataset: "ventas",
        axis: "cliente", // Relación -> exige motor en memoria
        values: [{ field: "total", agg: "sum" }],
        filters: [], // Sin filtro de fechas
      })
    ).rejects.toThrow(/requiere al menos un filtro de fechas/);
  });

  it("bloquea consultas que superen el límite de seguridad de 50.000 filas", async () => {
    countMock.mockResolvedValueOnce(55000);

    await expect(
      executeDashboardQueryService({
        dataset: "ventas",
        axis: "cliente",
        values: [{ field: "total", agg: "sum" }],
        filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
      })
    ).rejects.toThrow(/supera el límite de seguridad de 50,000 registros/);
  });

  it("ejecuta motor híbrido con filtro de fechas para dimensiones relacionales", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: 1,
        totalAmount: 100,
        customer: { firstName: "Restaurante", lastName: "Don Pepe", personType: "JURIDICA" },
      },
      {
        id: 2,
        totalAmount: 150,
        customer: { firstName: "Restaurante", lastName: "Don Pepe", personType: "JURIDICA" },
      },
    ]);

    const result = await executeDashboardQueryService({
      dataset: "ventas",
      axis: "cliente",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
    });

    expect(result.meta.engine).toBe("in_memory_hybrid");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].cliente).toBe("Restaurante Don Pepe");
    expect(result.rows[0]["total_sum"]).toBe(250);
  });

  it("calcula medidas en memoria para inventario sin requerir filtro de fecha (dataset no transaccional)", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Pollo Entero",
        type: "RawMaterial",
        currentStock: 20,
        averageCost: 15.5,
      },
    ]);

    const result = await executeDashboardQueryService({
      dataset: "inventario",
      axis: "tipo",
      values: [{ field: "valorInventario", agg: "sum" }],
    });

    expect(result.meta.engine).toBe("in_memory_hybrid");
    expect(result.rows[0].tipo).toBe("Insumo");
    expect(result.rows[0]["valorInventario_sum"]).toBe(310);
  });

  it("fusiona el baseFilter del dataset en la cláusula where enviada a Prisma", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await executeDashboardQueryService({
      dataset: "ventas",
      axis: "cliente",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ["Cancelled"] },
        }),
      })
    );
  });

  it("in_memory_hybrid: 1,500 comprobantes de 3 clientes deben devolver 3 filas con sumas exactas y truncated: false", async () => {
    const mockVentas = [];
    for (let i = 0; i < 500; i++) {
      mockVentas.push({ id: i + 1, totalAmount: 10, customer: { firstName: "Juan", lastName: "Perez" } });
      mockVentas.push({ id: i + 501, totalAmount: 20, customer: { firstName: "Maria", lastName: "Gomez" } });
      mockVentas.push({ id: i + 1001, totalAmount: 30, customer: { firstName: "Carlos", lastName: "Lopez" } });
    }
    findManyMock.mockResolvedValueOnce(mockVentas);

    const result = await executeDashboardQueryService({
      dataset: "ventas",
      axis: "cliente",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
    });

    expect(result.meta.engine).toBe("in_memory_hybrid");
    expect(result.rows).toHaveLength(3);
    expect(result.meta.truncated).toBe(false);

    const map = new Map(result.rows.map((r) => [r.cliente, r["total_sum"]]));
    expect(map.get("Juan Perez")).toBe(5000);
    expect(map.get("Maria Gomez")).toBe(10000);
    expect(map.get("Carlos Lopez")).toBe(15000);
  });

  it("in_memory_hybrid: 250 clientes distintos con limit 200 deben devolver 200 filas y truncated: true", async () => {
    const mockVentas = [];
    for (let i = 1; i <= 250; i++) {
      mockVentas.push({
        id: i,
        totalAmount: 100,
        customer: { firstName: `Cliente`, lastName: `#${i}` },
      });
    }
    findManyMock.mockResolvedValueOnce(mockVentas);

    const result = await executeDashboardQueryService({
      dataset: "ventas",
      axis: "cliente",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
      limit: 200,
    });

    expect(result.meta.engine).toBe("in_memory_hybrid");
    expect(result.rows).toHaveLength(200);
    expect(result.meta.truncated).toBe(true);
  });

  it("calcula ticket promedio como sum(importeTotal) / count(pedidos) asegurando que sum/sum != promedio de ratios", async () => {
    // Pedido 1: 1 plato de 100 soles -> ratio 100
    // Pedido 2: 9 platos de 10 soles = 90 soles -> ratio 10
    // Total importe: 190 soles. Total pedidos: 2.
    // Ticket promedio real (sum/sum): 190 / 2 = 95 soles.
    // Promedio de ratios: (100 + 10) / 2 = 55 soles (95 != 55).
    findManyMock.mockResolvedValueOnce([
      {
        id: 101,
        code: "PED-001",
        items: [{ id: 1, subtotal: 100, quantity: 1 }],
      },
      {
        id: 102,
        code: "PED-002",
        items: [
          { id: 2, subtotal: 50, quantity: 5 },
          { id: 3, subtotal: 40, quantity: 4 },
        ],
      },
    ]);

    const result = await executeDashboardQueryService({
      dataset: "pedidos",
      values: [
        { field: "importeTotal", agg: "sum" },
        { field: "numPedidos", agg: "count" },
        { field: "ticketPromedio", agg: "avg" },
      ],
      filters: [{ field: "fechaHora", operator: "gt", value: "2026-01-01" }],
    });

    expect(result.rows[0]["importeTotal_sum"]).toBe(190);
    expect(result.rows[0]["numPedidos_count"]).toBe(2);
    expect(result.rows[0]["ticketPromedio_avg"]).toBe(95); // 190 / 2 = 95, NO 55
  });

  it("marca truncated: true y aplica límite de serie temporal de al menos 1000 registros", async () => {
    countMock.mockResolvedValueOnce(1500);
    findManyMock.mockResolvedValueOnce(
      new Array(1001).fill(null).map((_, i) => ({
        id: i + 1,
        totalAmount: 10,
        createdAt: new Date(Date.UTC(2020, 0, 1) + i * 86400000),
      }))
    );

    const result = await executeDashboardQueryService({
      dataset: "ventas",
      axis: "fechaCreacion",
      granularity: "day",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
    });

    expect(result.meta.truncated).toBe(true);
    expect(result.meta.totalRows).toBeLessThanOrEqual(1000);
  });

  it("interpreta filtro between con hasTime=true en America/Lima (inicio 00:00 Lima, fin 00:00 Lima del día siguiente excluyente)", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await executeDashboardQueryService({
      dataset: "pedidos",
      axis: "tipoPedido",
      values: [{ field: "numPedidos", agg: "count" }],
      filters: [{ field: "fechaHora", operator: "between", value: ["2026-05-01", "2026-05-31"] }],
    });

    const whereCall = findManyMock.mock.calls[findManyMock.mock.calls.length - 1][0].where;
    expect(whereCall.orderedAt).toBeDefined();

    const startUtc = whereCall.orderedAt.gte as Date;
    const endUtc = whereCall.orderedAt.lt as Date;

    // 00:00 Lima del 01 de mayo = 05:00 UTC
    expect(startUtc.toISOString()).toBe("2026-05-01T05:00:00.000Z");
    // 00:00 Lima del 01 de junio (día siguiente al 31 de mayo) = 05:00 UTC excluyente
    expect(endUtc.toISOString()).toBe("2026-06-01T05:00:00.000Z");

    // Test caso 1: Pedido a las 23:30 Lima del 31 de mayo (04:30 UTC del 1 de junio) SÍ debe entrar
    const pedidoFinMes = new Date("2026-06-01T04:30:00.000Z");
    const entraFinMes = pedidoFinMes >= startUtc && pedidoFinMes < endUtc;
    expect(entraFinMes).toBe(true);

    // Test caso 2: Pedido a las 22:00 Lima del 30 de abril (03:00 UTC del 1 de mayo) NO debe entrar
    const pedidoFinMesAnterior = new Date("2026-05-01T03:00:00.000Z");
    const entraMesAnterior = pedidoFinMesAnterior >= startUtc && pedidoFinMesAnterior < endUtc;
    expect(entraMesAnterior).toBe(false);
  });

  it("compara fechas UTC tal cual (inclusive) para campos con hasTime=false (@db.Date)", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await executeDashboardQueryService({
      dataset: "ventas",
      axis: "cliente",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "between", value: ["2026-05-01", "2026-05-31"] }],
    });

    const whereCall = findManyMock.mock.calls[findManyMock.mock.calls.length - 1][0].where;
    expect(whereCall.issuedAt).toBeDefined();
    expect(whereCall.issuedAt.gte).toBeInstanceOf(Date);
    expect(whereCall.issuedAt.lte).toBeInstanceOf(Date);
  });

  it("in_memory_hybrid: Top 3 de 10 grupos por suma desc devuelve los 3 mayores correctos antes de recortar con limit", async () => {
    // 10 clientes con montos del 10 al 100
    const mockVentas = [];
    for (let i = 1; i <= 10; i++) {
      mockVentas.push({
        id: i,
        totalAmount: i * 10, // 10, 20, 30, ... 100
        customer: { firstName: "Cliente", lastName: `#${i}` },
      });
    }
    findManyMock.mockResolvedValueOnce(mockVentas);

    const result = await executeDashboardQueryService({
      dataset: "ventas",
      axis: "cliente",
      values: [{ field: "total", agg: "sum" }],
      filters: [{ field: "fecha", operator: "gt", value: "2026-01-01" }],
      sort: { by: "total_sum", dir: "desc" },
      limit: 3,
    });

    expect(result.rows).toHaveLength(3);
    expect(result.meta.truncated).toBe(true);
    expect(result.rows[0].cliente).toBe("Cliente #10");
    expect(result.rows[0]["total_sum"]).toBe(100);
    expect(result.rows[1].cliente).toBe("Cliente #9");
    expect(result.rows[1]["total_sum"]).toBe(90);
    expect(result.rows[2].cliente).toBe("Cliente #8");
    expect(result.rows[2]["total_sum"]).toBe(80);
  });

  it("prisma_groupby: ordena por agregado (_sum, _avg, etc.) cuando sort.by es una medida y recorta los mayores", async () => {
    groupByMock.mockResolvedValueOnce([
      { type: "FinishedProduct", _sum: { currentStock: 1000 } },
      { type: "RawMaterial", _sum: { currentStock: 500 } },
      { type: "Supplies", _sum: { currentStock: 200 } },
      { type: "Packaging", _sum: { currentStock: 50 } }, // 4º elemento que excede el limit 3
    ]);

    const result = await executeDashboardQueryService({
      dataset: "inventario",
      axis: "tipo",
      values: [{ field: "stockActual", agg: "sum" }],
      sort: { by: "stockActual_sum", dir: "desc" },
      limit: 3,
    });

    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          _sum: {
            currentStock: "desc",
          },
        },
        take: 4, // limit 3 + 1 para comprobar truncamiento
      })
    );

    expect(result.rows).toHaveLength(3);
    expect(result.meta.truncated).toBe(true);
    expect(result.rows[0]["stockActual_sum"]).toBe(1000);
    expect(result.rows[1]["stockActual_sum"]).toBe(500);
    expect(result.rows[2]["stockActual_sum"]).toBe(200);
  });

  it("el endpoint POST /api/dashboards/query valida y responde 200 con éxito", async () => {
    aggregateMock.mockResolvedValueOnce({
      _sum: { totalAmount: 7600 },
    });

    const req = new NextRequest("http://localhost:3000/api/dashboards/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset: "ventas",
        values: [{ field: "total", agg: "sum" }],
      }),
    });

    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.rows[0]["total_sum"]).toBe(7600);
  });

  it("orden de ejes: weekday se ordena cronológicamente Lunes a Domingo y no alfabéticamente", async () => {
    // 2026-05-06T18:00Z -> Lima: Miércoles 13:00
    // 2026-05-03T18:00Z -> Lima: Domingo 13:00
    // 2026-05-04T18:00Z -> Lima: Lunes 13:00
    // 2026-05-08T18:00Z -> Lima: Viernes 13:00
    findManyMock.mockResolvedValueOnce([
      { id: 1, orderedAt: new Date("2026-05-06T18:00:00.000Z"), items: [] },
      { id: 2, orderedAt: new Date("2026-05-03T18:00:00.000Z"), items: [] },
      { id: 3, orderedAt: new Date("2026-05-04T18:00:00.000Z"), items: [] },
      { id: 4, orderedAt: new Date("2026-05-08T18:00:00.000Z"), items: [] },
    ]);

    const result = await executeDashboardQueryService({
      dataset: "pedidos",
      axis: "fechaHora",
      granularity: "weekday",
      values: [{ field: "numPedidos", agg: "count" }],
      filters: [{ field: "fechaHora", operator: "gt", value: "2026-01-01" }],
    });

    expect(result.rows).toHaveLength(4);
    const dayLabels = result.rows.map((r) => r.fechaHora);
    expect(dayLabels).toEqual(["Lunes", "Miércoles", "Viernes", "Domingo"]);
  });

  it("truncado de serie temporal: conserva los grupos MÁS RECIENTES y los devuelve en asc", async () => {
    findManyMock.mockResolvedValueOnce([
      { id: 1, orderedAt: new Date("2026-05-01T15:00:00.000Z"), items: [] },
      { id: 2, orderedAt: new Date("2026-05-02T15:00:00.000Z"), items: [] },
      { id: 3, orderedAt: new Date("2026-05-03T15:00:00.000Z"), items: [] },
      { id: 4, orderedAt: new Date("2026-05-04T15:00:00.000Z"), items: [] },
      { id: 5, orderedAt: new Date("2026-05-05T15:00:00.000Z"), items: [] },
    ]);

    const result = await executeDashboardQueryService({
      dataset: "pedidos",
      axis: "fechaHora",
      granularity: "day",
      values: [{ field: "numPedidos", agg: "count" }],
      filters: [{ field: "fechaHora", operator: "gt", value: "2026-01-01" }],
      limit: 3,
    });

    expect(result.rows).toHaveLength(3);
    expect(result.meta.truncated).toBe(true);
    // Debe conservar los 3 más recientes (3, 4, 5 de Mayo) y ordenados en asc
    const dates = result.rows.map((r) => r.fechaHora);
    expect(dates).toEqual(["2026-05-03", "2026-05-04", "2026-05-05"]);
  });

  it("filtro de fechas end-to-end con prismaPath anidado: platos_vendidos (hasTime=true), contabilidad y compras_detalle (hasTime=false)", async () => {
    // 1. platos_vendidos: fechaHora -> order.orderedAt (hasTime: true)
    findManyMock.mockResolvedValueOnce([]);
    await executeDashboardQueryService({
      dataset: "platos_vendidos",
      axis: "tipoProducto",
      values: [{ field: "cantidad", agg: "sum" }],
      filters: [{ field: "fechaHora", operator: "between", value: ["2026-05-01", "2026-05-31"] }],
    });

    expect(findManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          itemStatus: { notIn: ["Cancelled"] },
          order: expect.objectContaining({
            orderedAt: {
              gte: new Date("2026-05-01T05:00:00.000Z"),
              lt: new Date("2026-06-01T05:00:00.000Z"),
            },
          }),
        }),
      })
    );

    // 2. contabilidad: fecha -> entry.entryDate (hasTime: false)
    findManyMock.mockResolvedValueOnce([]);
    await executeDashboardQueryService({
      dataset: "contabilidad",
      axis: "origen",
      values: [{ field: "debe", agg: "sum" }],
      filters: [{ field: "fecha", operator: "between", value: ["2026-05-01", "2026-05-31"] }],
    });

    expect(findManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entry: expect.objectContaining({
            status: true,
            entryDate: {
              gte: new Date("2026-05-01T00:00:00.000Z"),
              lte: new Date("2026-05-31T00:00:00.000Z"),
            },
          }),
        }),
      })
    );

    // 3. compras_detalle: fecha -> purchaseOrder.issuedAt (hasTime: false)
    findManyMock.mockResolvedValueOnce([]);
    await executeDashboardQueryService({
      dataset: "compras_detalle",
      axis: "insumo",
      values: [{ field: "cantidad", agg: "sum" }],
      filters: [{ field: "fecha", operator: "between", value: ["2026-05-01", "2026-05-31"] }],
    });

    expect(findManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          purchaseOrder: {
            issuedAt: {
              gte: new Date("2026-05-01T00:00:00.000Z"),
              lte: new Date("2026-05-31T00:00:00.000Z"),
            },
          },
        }),
      })
    );
  });

  it("granularidad hourOfDay: una venta a las 04:30 UTC cae en '23:00' Lima y el orden devuelto es 00:00 -> 23:00", async () => {
    // 1. Verificación directa de formateo de fecha
    const fechaUTC = new Date("2026-05-10T04:30:00.000Z"); // 04:30 UTC = 23:30 Lima día anterior
    const labelLima = formatSemanticDate(fechaUTC, true, "hourOfDay");
    expect(labelLima).toBe("23:00");

    // 2. Verificación en el motor de consulta con orden numérico 00 -> 23
    findManyMock.mockResolvedValueOnce([
      { id: 1, orderedAt: new Date("2026-05-10T04:30:00.000Z"), items: [] }, // 23:00 Lima
      { id: 2, orderedAt: new Date("2026-05-10T05:15:00.000Z"), items: [] }, // 00:00 Lima
      { id: 3, orderedAt: new Date("2026-05-10T17:00:00.000Z"), items: [] }, // 12:00 Lima
    ]);

    const result = await executeDashboardQueryService({
      dataset: "pedidos",
      axis: "fechaHora",
      granularity: "hourOfDay",
      values: [{ field: "numPedidos", agg: "count" }],
      filters: [{ field: "fechaHora", operator: "gt", value: "2026-01-01" }],
    });

    expect(result.rows).toHaveLength(3);
    const hourLabels = result.rows.map((r) => r.fechaHora);
    expect(hourLabels).toEqual(["00:00", "12:00", "23:00"]);
  });
});
