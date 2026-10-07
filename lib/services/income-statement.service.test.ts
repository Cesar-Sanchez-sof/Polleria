import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  accountFindMany: vi.fn(),
  detailGroupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingAccount: { findMany: m.accountFindMany },
    journalEntryDetail: { groupBy: m.detailGroupBy },
  },
}));

import {
  ErrorIncomeStatement,
  getIncomeStatement,
  type IncomeStatementResult,
} from "./income-statement.service";

/** Saldos agregados por cuenta devueltos por `groupBy` (accountId, sums). */
const GROUP_BY_RESULT = [
  { accountId: 1, _sum: { debit: 0, credit: 970 } }, // 701 Ventas
  { accountId: 2, _sum: { debit: 50, credit: 0 } }, // 709 Devoluciones
  { accountId: 3, _sum: { debit: 400, credit: 0 } }, // 691 Costo de ventas
  { accountId: 4, _sum: { debit: 100, credit: 0 } }, // 88 Impuesto
  { accountId: 5, _sum: { debit: 0, credit: 30 } }, // 771 Ingresos financieros
];

const ACCOUNTS = [
  { id: 1, code: "701", name: "Ventas de Mercaderías", active: true },
  { id: 2, code: "709", name: "Devoluciones en Ventas", active: true },
  { id: 3, code: "691", name: "Costo de Ventas de Mercaderías", active: true },
  { id: 4, code: "88", name: "Impuesto a la Renta", active: true },
  { id: 5, code: "771", name: "Ingresos Financieros", active: true },
];

async function catchError(promise: Promise<unknown>): Promise<ErrorIncomeStatement> {
  try {
    await promise;
  } catch (err) {
    return err as ErrorIncomeStatement;
  }
  throw new Error("La petición no lanzó el error esperado.");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.accountFindMany.mockResolvedValue(ACCOUNTS);
  m.detailGroupBy.mockResolvedValue(GROUP_BY_RESULT);
});

describe("getIncomeStatement: validación de periodo (FR-003 a FR-005)", () => {
  it("rechaza la fecha inicial vacía con 400", async () => {
    const err = await catchError(getIncomeStatement({ startDate: "", endDate: "2026-01-31" }));
    expect(err).toBeInstanceOf(ErrorIncomeStatement);
    expect(err.status).toBe(400);
    expect(err.message).toBe(
      "La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD."
    );
  });

  it("rechaza una fecha inicial con formato inválido con 400", async () => {
    const err = await catchError(
      getIncomeStatement({ startDate: "31/01/2026", endDate: "2026-01-31" })
    );
    expect(err.status).toBe(400);
    expect(err.message).toBe(
      "La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD."
    );
    expect(m.detailGroupBy).not.toHaveBeenCalled();
  });

  it("rechaza una fecha final inexistente (2026-02-31) con 400", async () => {
    const err = await catchError(
      getIncomeStatement({ startDate: "2026-01-01", endDate: "2026-02-31" })
    );
    expect(err.status).toBe(400);
    expect(err.message).toBe(
      "La fecha final es obligatoria y debe tener el formato AAAA-MM-DD."
    );
  });

  it("rechaza un periodo invertido (inicial posterior a la final) con 400", async () => {
    const err = await catchError(
      getIncomeStatement({ startDate: "2026-02-01", endDate: "2026-01-31" })
    );
    expect(err.status).toBe(400);
    expect(err.message).toBe("El periodo es inválido: la fecha inicial no puede ser posterior a la final.");
    expect(m.detailGroupBy).not.toHaveBeenCalled();
  });
});

describe("getIncomeStatement: consulta a la base de datos (FR-023 a FR-025)", () => {
  it("agrupa por cuenta filtrando asientos activos dentro del rango (UTC)", async () => {
    await getIncomeStatement({ startDate: "2026-01-01", endDate: "2026-01-31" });

    expect(m.accountFindMany).toHaveBeenCalledWith({
      where: { active: true },
      select: { id: true, code: true, name: true, active: true },
      orderBy: { code: "asc" },
    });

    const where = m.detailGroupBy.mock.calls[0][0].where;
    expect(where.accountId).toEqual({ in: [1, 2, 3, 4, 5] });
    expect(where.entry.status).toBe(true);
    expect(where.entry.entryDate.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(where.entry.entryDate.lte.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("devuelve ceros cuando no hay movimientos, sin lanzar error (FR-020)", async () => {
    m.detailGroupBy.mockResolvedValue([]);

    const result = await getIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.net_profit.amount).toBe(0);
    expect(result.operating_income.ordinary_income).toBe(0);
    expect(result.gross_profit.amount).toBe(0);
    expect(result.income_tax_expense.amount).toBe(0);
    expect(result.currency).toBe("PEN");
  });

  it("mapea accountId → código sin alterar los agregados de groupBy (T013)", async () => {
    const result = await getIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    // Debe/Haber crudos: 970 Haber de ventas, 50 Debe de devoluciones.
    expect(result.operating_income.ordinary_income).toBe(920);
    expect(result.sales_costs.cost_of_goods_sold).toBe(400);
    expect(result.income_tax_expense.amount).toBe(100);
    expect(result.financial_income.amount).toBe(30);
    expect(result.net_profit.amount).toBe(450);
  });

  it("propaga el error de la base de datos como ErrorIncomeStatement 500", async () => {
    m.detailGroupBy.mockRejectedValue(new Error("connection refused"));

    const err = await catchError(
      getIncomeStatement({ startDate: "2026-01-01", endDate: "2026-01-31" })
    );
    expect(err).toBeInstanceOf(ErrorIncomeStatement);
    expect(err.status).toBe(500);
    expect(err.message).toBe("No se pudo generar el Estado de Resultados.");
  });
});

describe("getIncomeStatement: movimientos precargados (FR-023)", () => {
  it("usa los movimientos recibidos sin consultar la base de datos", async () => {
    const result: IncomeStatementResult = await getIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      movements: [
        { account_code: "701", credit: 1000, date: "2026-01-10", status: true },
        { account_code: "709", debit: 50, date: "2026-01-12", status: true },
        { account_code: "691", debit: 200, date: "2026-01-15", status: true },
        // Anulado y fuera de rango: se excluyen (FR-024, FR-025)
        { account_code: "701", credit: 7777, date: "2026-01-20", status: false },
        { account_code: "701", credit: 8888, date: "2025-12-31", status: true },
      ],
    });

    expect(m.accountFindMany).not.toHaveBeenCalled();
    expect(m.detailGroupBy).not.toHaveBeenCalled();
    expect(result.operating_income.ordinary_income).toBe(950);
    expect(result.sales_costs.cost_of_goods_sold).toBe(200);
    expect(result.net_profit.amount).toBe(750);
  });
});

describe("getIncomeStatement: signos de los agregados (T013, FR-019)", () => {
  it("no invierte ni promedia los saldos de groupBy: 950 y -150", async () => {
    m.accountFindMany.mockResolvedValue([
      { id: 1, code: "701", name: "Ventas", active: true },
      { id: 2, code: "691", name: "Costo de ventas", active: true },
    ]);
    m.detailGroupBy.mockResolvedValue([
      { accountId: 1, _sum: { debit: 50, credit: 1000 } },
      { accountId: 2, _sum: { debit: 150, credit: 300 } },
    ]);

    const result = await getIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    // 701 por Haber − Debe = 950; 691 por Debe − Haber = -150 (saldo acreedor).
    expect(result.operating_income.ordinary_income).toBe(950);
    expect(result.sales_costs.cost_of_goods_sold).toBe(-150);
    expect(result.gross_profit.amount).toBe(1100);
    expect(result.net_profit.amount).toBe(1100);
  });

  it("descarta cuentas que ya no existen o están inactivas en el catálogo", async () => {
    m.accountFindMany.mockResolvedValue([{ id: 7, code: "701", name: "Ventas", active: true }]);
    m.detailGroupBy.mockResolvedValue([{ accountId: 7, _sum: { debit: 0, credit: 400 } }]);

    const result = await getIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(result.operating_income.ordinary_income).toBe(400);
  });
});
