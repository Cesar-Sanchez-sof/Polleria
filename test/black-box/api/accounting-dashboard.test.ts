import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { accountFindManyMock, detailGroupByMock, entryCountMock, queryRawMock } = vi.hoisted(
  () => ({
    accountFindManyMock: vi.fn(),
    detailGroupByMock: vi.fn(),
    entryCountMock: vi.fn(),
    queryRawMock: vi.fn(),
  })
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingAccount: { findMany: accountFindManyMock },
    journalEntryDetail: { groupBy: detailGroupByMock },
    journalEntry: { count: entryCountMock },
    $queryRaw: queryRawMock,
  },
}));

import { GET } from "@/app/api/accounting/dashboard/route";

function createRequest(query = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/accounting/dashboard${query}`),
  } as unknown as NextRequest;
}

/** Catálogo mínimo: P&L (701/621) + balance (101/121/421). */
function createAccounts() {
  return [
    { id: 1, code: "101", name: "Caja", type: "Activo" },
    { id: 2, code: "121", name: "Clientes nacionales", type: "Activo" },
    { id: 3, code: "421", name: "Proveedores nacionales", type: "Pasivo" },
    { id: 4, code: "621", name: "Sueldos y remuneraciones", type: "Gasto" },
    { id: 5, code: "701", name: "Ventas", type: "Ingreso" },
  ];
}

/** `groupBy` simulado: `rows` = [accountId, debit, credit]. */
function groupByResult(rows: Array<[number, number, number]>) {
  return rows.map(([accountId, debit, credit]) => ({
    accountId,
    _sum: { debit, credit },
  }));
}

describe("GET /api/accounting/dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    accountFindManyMock.mockResolvedValue(createAccounts());
    entryCountMock.mockResolvedValue(0);
    queryRawMock.mockResolvedValue([]);
    // Por defecto, sin movimiento: el mock específico por llamada se fija en cada test.
    detailGroupByMock.mockResolvedValue([]);
  });

  it("devuelve 200 con los KPI calculados a partir de los agregados (rango + acumulado)", async () => {
    // 6 llamadas a groupBy (Promise.all):
    // 0: rango actual, 1: acumulado actual, 2: rango previo, 3: acumulado previo
    // (el conteo de asientos usa entryCountMock, no groupBy)
    detailGroupByMock
      .mockResolvedValueOnce(
        // rango actual: ingresos 1200.50 (id 5), gastos 400 (id 4)
        groupByResult([
          [5, 0, 1200.5],
          [4, 400, 0],
        ])
      )
      .mockResolvedValueOnce(
        // acumulado hasta `hasta`: caja 5500, clientes 500, proveedores 800
        groupByResult([
          [1, 5500, 0],
          [2, 500, 0],
          [3, 100, 900],
        ])
      )
      .mockResolvedValueOnce(groupByResult([])) // rango previo
      .mockResolvedValueOnce(groupByResult([])); // acumulado previo
    entryCountMock.mockResolvedValueOnce(7).mockResolvedValueOnce(0);

    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.period).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
      label: "01 de marzo — 31 de marzo de 2026",
    });
    expect(body.previousPeriod).toBeNull();
    expect(body.meta).toMatchObject({ currency: "PEN", empty: false });

    const byKey = new Map<string, { value: number; variation: unknown }>(
      body.kpis.map((k: { key: string; value: number; variation: unknown }) => [k.key, k])
    );
    expect(byKey.get("income")?.value).toBe(1200.5);
    expect(byKey.get("expenses")?.value).toBe(400);
    expect(byKey.get("profit")?.value).toBe(800.5);
    expect(byKey.get("caja_bancos")?.value).toBe(5500);
    expect(byKey.get("por_cobrar")?.value).toBe(500);
    expect(byKey.get("por_pagar")?.value).toBe(800);
    expect(byKey.get("entries")?.value).toBe(7);
    // Sin datos previos → todas las variaciones null
    expect(body.kpis.every((k: { variation: null }) => k.variation === null)).toBe(true);
  });

  it("incluye previousPeriod y variaciones cuando el período anterior tiene datos", async () => {
    detailGroupByMock
      .mockResolvedValueOnce(groupByResult([[5, 0, 1200]])) // rango actual: ingresos 1200
      .mockResolvedValueOnce(groupByResult([])) // acumulado actual
      .mockResolvedValueOnce(groupByResult([[5, 0, 600]])) // rango previo: ingresos 600
      .mockResolvedValueOnce(groupByResult([])); // acumulado previo
    entryCountMock.mockResolvedValue(3);

    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    const body = await response.json();

    expect(body.previousPeriod).toEqual({ from: "2026-01-29", to: "2026-02-28" });
    const income = body.kpis.find((k: { key: string }) => k.key === "income");
    expect(income.variation).toEqual({ percent: 100, direction: "up" });
  });

  it("marca meta.empty = true cuando no hay asientos ni movimiento en el rango", async () => {
    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    const body = await response.json();
    expect(body.meta.empty).toBe(true);
    expect(body.kpis.every((k: { value: number }) => k.value === 0)).toBe(true);
    // Sin filas mensuales → el mes del rango aparece en 0; sin gastos ni top cuentas
    expect(body.monthlySeries).toEqual([
      { month: "2026-03", label: expect.any(String), income: 0, expenses: 0, profit: 0 },
    ]);
    expect(body.expenseBreakdown).toEqual([]);
    expect(body.topAccounts).toEqual([]);
  });

  it("puebla la serie mensual desde $queryRaw con date_trunc (US2/T015)", async () => {
    detailGroupByMock
      .mockResolvedValueOnce(
        groupByResult([
          [5, 0, 1200], // Ventas (Ingreso) en el rango
          [4, 400, 0], // Sueldos (Gasto) en el rango
        ])
      )
      .mockResolvedValueOnce(groupByResult([]))
      .mockResolvedValueOnce(groupByResult([]))
      .mockResolvedValueOnce(groupByResult([]));
    queryRawMock.mockResolvedValue([
      { month: new Date("2026-02-01T00:00:00.000Z"), type: "Ingreso", debit: BigInt(0), credit: 900 },
      { month: new Date("2026-02-01T00:00:00.000Z"), type: "Gasto", debit: 500, credit: 0 },
      { month: new Date("2026-03-01T00:00:00.000Z"), type: "Ingreso", debit: 0, credit: 1200 },
      { month: new Date("2026-03-01T00:00:00.000Z"), type: "Gasto", debit: 400, credit: 0 },
    ]);

    const response = await GET(createRequest("?desde=2026-02-01&hasta=2026-03-31"));
    const body = await response.json();

    expect(body.monthlySeries).toHaveLength(2);
    expect(body.monthlySeries[0]).toMatchObject({
      month: "2026-02",
      income: 900,
      expenses: 500,
      profit: 400,
    });
    expect(body.monthlySeries[1]).toMatchObject({
      month: "2026-03",
      income: 1200,
      expenses: 400,
      profit: 800,
    });
  });

  it("incluye distribución de gastos y top cuentas en el payload (US2)", async () => {
    detailGroupByMock
      .mockResolvedValueOnce(
        groupByResult([
          [4, 600, 0], // Sueldos (Gasto)
          [5, 0, 1200], // Ventas (Ingreso)
        ])
      )
      .mockResolvedValueOnce(groupByResult([]))
      .mockResolvedValueOnce(groupByResult([]))
      .mockResolvedValueOnce(groupByResult([]));

    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    const body = await response.json();

    expect(body.expenseBreakdown).toEqual([
      { category: "Gastos de personal", code: "62", amount: 600, percent: 100 },
    ]);
    expect(body.topAccounts).toEqual([
      { code: "701", name: "Ventas", amount: 1200 },
      { code: "621", name: "Sueldos y remuneraciones", amount: 600 },
    ]);
  });

  it("devuelve 400 con fecha mal formada", async () => {
    const response = await GET(createRequest("?desde=31/03/2026&hasta=2026-03-31"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Las fechas deben tener el formato YYYY-MM-DD.");
    expect(detailGroupByMock).not.toHaveBeenCalled();
  });

  it("devuelve 400 con fechas ausentes", async () => {
    const response = await GET(createRequest("?desde=2026-03-01"));
    expect(response.status).toBe(400);
  });

  it("devuelve 400 cuando desde es posterior a hasta", async () => {
    const response = await GET(createRequest("?desde=2026-03-31&hasta=2026-03-01"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(
      "Las fechas deben tener el formato YYYY-MM-DD y desde no puede ser posterior a hasta."
    );
  });

  it("devuelve 404 cuando no hay cuentas contables activas", async () => {
    accountFindManyMock.mockResolvedValue([]);
    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("No hay cuentas contables activas para elaborar el dashboard.");
  });

  it("devuelve 500 cuando Prisma falla", async () => {
    detailGroupByMock.mockRejectedValue(new Error("db down"));
    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("No se pudo generar el Dashboard Contable.");
  });
});
