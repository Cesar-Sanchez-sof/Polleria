import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { accountFindManyMock, detailGroupByMock } = vi.hoisted(() => ({
  accountFindManyMock: vi.fn(),
  detailGroupByMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingAccount: { findMany: accountFindManyMock },
    journalEntryDetail: { groupBy: detailGroupByMock },
  },
}));

import { GET } from "./route";

function createRequest(query = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/cash-flow-statement${query}`),
  } as unknown as NextRequest;
}

const ACCOUNTS = [
  { id: 1, code: "101", name: "Caja", type: "Activo" },
  { id: 2, code: "104", name: "Bancos", type: "Activo" },
  { id: 3, code: "121", name: "Clientes nacionales", type: "Activo" },
  { id: 4, code: "701", name: "Ventas mercaderías", type: "Ingreso" },
];

/**
 * Atiende los 3 `groupBy` de la ruta según la ventana consultada:
 * `lt` = saldo inicial (< desde), `gte` = ventana del período, `lte` = saldo final (<= hasta).
 */
function mockGroupBy({
  initial = [] as unknown[],
  period = [] as unknown[],
  final = [] as unknown[],
} = {}) {
  detailGroupByMock.mockImplementation(async ({ where }: { where: { entry: { entryDate: Record<string, unknown> } } }) => {
    const range = where.entry.entryDate;
    if ("gte" in range) return period;
    if ("lt" in range) return initial;
    return final;
  });
}

const sum = (rows: Array<{ accountId: number; debit: number; credit: number }>) =>
  rows.map((row) => ({ accountId: row.accountId, _sum: { debit: row.debit, credit: row.credit } }));

describe("GET /api/cash-flow-statement (estado de flujos de efectivo)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    accountFindManyMock.mockResolvedValue(ACCOUNTS);
    detailGroupByMock.mockResolvedValue([]);
  });

  /* ---- 400 ------------------------------------------------------------ */

  it("400 si falta o tiene formato inválido el parámetro desde (FR-001)", async () => {
    const response = await GET(createRequest("?hasta=2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El parámetro 'desde' debe tener el formato YYYY-MM-DD." });
    expect(accountFindManyMock).not.toHaveBeenCalled();
    expect(detailGroupByMock).not.toHaveBeenCalled();
  });

  it("400 si el parámetro hasta tiene formato inválido", async () => {
    const response = await GET(createRequest("?desde=2026-01-01&hasta=31/01/2026"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El parámetro 'hasta' debe tener el formato YYYY-MM-DD." });
    expect(detailGroupByMock).not.toHaveBeenCalled();
  });

  it("400 si desde es posterior a hasta", async () => {
    const response = await GET(createRequest("?desde=2026-02-01&hasta=2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El parámetro 'desde' no puede ser posterior a 'hasta'." });
    expect(accountFindManyMock).not.toHaveBeenCalled();
  });

  /* ---- 404 ------------------------------------------------------------ */

  it("404 si no hay cuentas contables activas", async () => {
    accountFindManyMock.mockResolvedValueOnce([]);

    const response = await GET(createRequest("?desde=2026-01-01&hasta=2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: "No hay cuentas contables activas para elaborar el estado de flujos de efectivo.",
    });
    expect(detailGroupByMock).not.toHaveBeenCalled();
  });

  /* ---- 200 ------------------------------------------------------------ */

  it("200: genera el reporte con las tres secciones y concilia el efectivo (SC-001)", async () => {
    accountFindManyMock.mockResolvedValueOnce(ACCOUNTS);
    mockGroupBy({
      initial: sum([
        { accountId: 1, debit: 5000, credit: 0 },
        { accountId: 3, debit: 1000, credit: 0 },
      ]),
      period: sum([
        { accountId: 1, debit: 2200, credit: 0 },
        { accountId: 3, debit: 0, credit: 500 },
        { accountId: 4, debit: 0, credit: 2000 },
      ]),
      final: sum([
        { accountId: 1, debit: 7500, credit: 0 },
        { accountId: 3, debit: 500, credit: 0 },
      ]),
    });

    const response = await GET(createRequest("?desde=2026-01-01&hasta=2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.currency).toBe("PEN");
    expect(body.period).toEqual({ startDate: "2026-01-01", endDate: "2026-01-31" });

    // Resultado 2000 (701) + capital de trabajo +500 (−Δ12) = flujo operativo 2500
    expect(body.operating_activities.net_profit).toBe(2000);
    expect(body.operating_activities.working_capital_changes.accounts_receivable).toBe(500);
    expect(body.operating_activities.net_cash_operating).toBe(2500);
    expect(body.investing_activities.net_cash_investing).toBe(0);
    expect(body.financing_activities.net_cash_financing).toBe(0);
    expect(body.net_cash_increase).toBe(2500);
    expect(body.cash_at_beginning).toBe(5000); // 101 de la ventana inicial
    expect(body.cash_at_end).toBe(7500);
    expect(body.is_reconciled).toBe(true);
    expect(body.reconciliation_difference).toBe(0);
  });

  it("consulta solo cuentas activas y asientos vigentes (status = true) en las 3 ventanas", async () => {
    mockGroupBy();

    await GET(createRequest("?desde=2026-01-01&hasta=2026-01-31"));

    expect(accountFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
    expect(detailGroupByMock).toHaveBeenCalledTimes(3);

    const [initialArgs, periodArgs, finalArgs] = detailGroupByMock.mock.calls.map(
      ([args]) => args as { where: { entry: { status: boolean; entryDate: Record<string, unknown> } } }
    );

    // Saldo inicial: estrictamente anterior a `desde`
    expect(initialArgs.where.entry.status).toBe(true);
    expect(initialArgs.where.entry.entryDate).toEqual({ lt: new Date("2026-01-01T00:00:00.000Z") });

    // Ventana del período [desde, hasta]
    expect(periodArgs.where.entry.status).toBe(true);
    expect(periodArgs.where.entry.entryDate).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-01-31T00:00:00.000Z"),
    });

    // Saldo final: acumulado hasta `hasta`
    expect(finalArgs.where.entry.status).toBe(true);
    expect(finalArgs.where.entry.entryDate).toEqual({ lte: new Date("2026-01-31T00:00:00.000Z") });
  });

  /* ---- US3: datos incompletos ---------------------------------------- */

  it("200 con catálogo amplio pero un solo grupo con datos: líneas sin mover en 0.00 (FR-007)", async () => {
    accountFindManyMock.mockResolvedValueOnce([
      ...ACCOUNTS,
      { id: 5, code: "421", name: "Proveedores nacionales", type: "Pasivo" },
    ]);
    mockGroupBy({
      initial: [{ accountId: 1, _sum: { debit: 100, credit: 0 } }],
      final: [{ accountId: 1, _sum: { debit: 100, credit: 0 } }],
    });

    const response = await GET(createRequest("?desde=2026-03-01&hasta=2026-03-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.currency).toBe("PEN");
    expect(body.operating_activities.net_profit).toBe(0);
    expect(body.operating_activities.net_cash_operating).toBe(0);
    expect(body.operating_activities.working_capital_changes.accounts_payable).toBe(0);
    expect(body.investing_activities.property_plant_equipment_purchases).toBe(0);
    expect(body.financing_activities.dividends_paid).toBe(0);
    expect(body.cash_at_beginning).toBe(100);
    expect(body.cash_at_end).toBe(100);
    expect(body.is_reconciled).toBe(true);
  });

  it("200 cuando el período no tiene movimientos: reporte en ceros y conciliado", async () => {
    mockGroupBy();

    const response = await GET(createRequest("?desde=2026-01-01&hasta=2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.net_cash_increase).toBe(0);
    expect(body.cash_at_beginning).toBe(0);
    expect(body.cash_at_end).toBe(0);
    expect(body.is_reconciled).toBe(true);
  });

  /* ---- 500 ------------------------------------------------------------ */

  it("200 con descuadre: incluye is_reconciled false y reconciliation_difference con signo (SC-005)", async () => {
    accountFindManyMock.mockResolvedValueOnce([
      { id: 1, code: "101", name: "Caja", type: "Activo" },
      { id: 5, code: "451", name: "Préstamos bancarios", type: "Pasivo" },
    ]);
    mockGroupBy({
      initial: sum([{ accountId: 1, debit: 3000, credit: 0 }]),
      period: sum([{ accountId: 5, debit: 0, credit: 1000 }]),
      final: sum([
        { accountId: 1, debit: 2600, credit: 0 },
        { accountId: 5, debit: 0, credit: 1000 },
      ]),
    });

    const response = await GET(createRequest("?desde=2026-02-01&hasta=2026-02-28"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.financing_activities.financial_obligations).toBe(1000);
    expect(body.cash_at_beginning).toBe(3000);
    expect(body.cash_at_end).toBe(4000); // 3000 + 1000 de Δ45
    expect(body.is_reconciled).toBe(false);
    expect(body.reconciliation_difference).toBe(-1400); // real 2600 − calculado 4000
  });

  it("500 si la consulta a la base de datos falla", async () => {
    detailGroupByMock.mockRejectedValueOnce(new Error("db down"));

    const response = await GET(createRequest("?desde=2026-01-01&hasta=2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo generar el Estado de Flujos de Efectivo." });
    expect(console.error).toHaveBeenCalled();
  });
});
