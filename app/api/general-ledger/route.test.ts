import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { parseUtcDate } from "@/lib/dates";

const { accountFindUniqueMock, detailAggregateMock, detailFindManyMock } = vi.hoisted(
  () => ({
    accountFindUniqueMock: vi.fn(),
    detailAggregateMock: vi.fn(),
    detailFindManyMock: vi.fn(),
  })
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingAccount: { findUnique: accountFindUniqueMock },
    journalEntryDetail: {
      aggregate: detailAggregateMock,
      findMany: detailFindManyMock,
    },
  },
}));

import { GET } from "./route";

function createRequest(query = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/general-ledger${query}`),
  } as unknown as NextRequest;
}

function createAccount() {
  return { id: 1, code: "101", name: "Caja", type: "Activo" };
}

function createDetailRow({
  id = 71,
  entryId = 7,
  dateStr = "2025-06-18",
  debit = 118,
  credit = 0,
  description = "Cobro en efectivo",
  entryOverrides = {},
}: {
  id?: number;
  entryId?: number;
  dateStr?: string;
  debit?: number;
  credit?: number;
  description?: string;
  entryOverrides?: Record<string, unknown>;
} = {}) {
  return {
    id,
    description,
    debit,
    credit,
    entry: {
      id: entryId,
      code: `MISC/2025/06/${String(entryId).padStart(4, "0")}`,
      entryDate: new Date(`${dateStr}T00:00:00.000Z`),
      description: "Venta mostrador",
      book: "Facturas de cliente",
      status: true,
      salesInvoice: null,
      purchaseInvoice: null,
      payroll: null,
      ...entryOverrides,
    },
  };
}

describe("GET /api/general-ledger (libro mayor)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    accountFindUniqueMock.mockResolvedValue(createAccount());
    detailAggregateMock.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
    detailFindManyMock.mockResolvedValue([]);
  });

  it("exige la cuenta contable a consultar (C01)", async () => {
    const response = await GET(createRequest(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Debe indicar la cuenta contable a consultar." });
    expect(accountFindUniqueMock).not.toHaveBeenCalled();
    expect(detailFindManyMock).not.toHaveBeenCalled();
  });

  it("responde 404 si la cuenta no existe (C01)", async () => {
    accountFindUniqueMock.mockResolvedValueOnce(null);

    const response = await GET(createRequest("?codigo=999"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Cuenta contable no encontrada." });
    expect(detailFindManyMock).not.toHaveBeenCalled();
  });

  it("devuelve el código y la denominación de la cuenta (C02)", async () => {
    detailFindManyMock.mockResolvedValueOnce([createDetailRow()]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(accountFindUniqueMock).toHaveBeenCalledWith({ where: { code: "101" } });
    expect(body.cuenta).toEqual({ codigo: "101", nombre: "Caja", tipo: "Activo" });
  });

  it("consulta los movimientos ordenados cronológicamente (C03)", async () => {
    detailFindManyMock.mockResolvedValueOnce([]);

    await GET(createRequest("?codigo=101"));

    expect(detailFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { entry: { entryDate: "asc" } },
          { entry: { id: "asc" } },
          { id: "asc" },
        ],
      })
    );
  });

  it("devuelve fecha, número de asiento y glosa de cada movimiento (C04-C06)", async () => {
    detailFindManyMock.mockResolvedValueOnce([
      createDetailRow({ entryId: 3, dateStr: "2025-06-18", description: "Cobro en efectivo" }),
    ]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(body.movimientos[0]).toMatchObject({
      id: 71,
      idAsiento: 3,
      numero: "MISC/2025/06/0003",
      fecha: "2025-06-18",
      glosa: "Venta mostrador",
      descripcion: "Cobro en efectivo",
    });
  });

  it("coloca el importe en Debe o en Haber según corresponda (C07)", async () => {
    detailFindManyMock.mockResolvedValueOnce([
      createDetailRow({ id: 71, debit: 118, credit: 0 }),
      createDetailRow({ id: 72, debit: 0, credit: 118, description: "Venta mercadería" }),
    ]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(
      body.movimientos.map((m: { debe: number; haber: number }) => [m.debe, m.haber])
    ).toEqual([
      [118, 0],
      [0, 118],
    ]);
  });

  it("calcula el saldo después de cada movimiento y si es deudor o acreedor (C08)", async () => {
    detailFindManyMock.mockResolvedValueOnce([
      createDetailRow({ id: 71, debit: 118, credit: 0 }),
      createDetailRow({ id: 72, debit: 0, credit: 200, description: "Pago proveedor" }),
    ]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(
      body.movimientos.map(
        (m: { saldo: number; tipoSaldo: string | null }) => [m.saldo, m.tipoSaldo]
      )
    ).toEqual([
      [118, "deudor"],
      [-82, "acreedor"],
    ]);
    expect(body.saldoFinal).toBe(-82);
  });

  it("parte del saldo anterior al periodo cuando se filtra (C08, C09)", async () => {
    detailAggregateMock.mockResolvedValueOnce({
      _sum: { debit: "350", credit: "200" },
    });
    detailFindManyMock.mockResolvedValueOnce([createDetailRow({ debit: 50, credit: 0 })]);

    const body = await (await GET(createRequest("?codigo=101&desde=2025-06-01"))).json();

    expect(detailAggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId: 1,
          entry: { entryDate: { lt: parseUtcDate("2025-06-01") } },
        },
      })
    );
    expect(body.saldoAnterior).toBe(150);
    expect(body.movimientos[0].saldo).toBe(200);
    expect(body.saldoFinal).toBe(200);
  });

  it("toma el saldo anterior en 0 cuando no hay fecha inicial (C08)", async () => {
    detailFindManyMock.mockResolvedValueOnce([createDetailRow({ debit: 40, credit: 0 })]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(detailAggregateMock).not.toHaveBeenCalled();
    expect(body.saldoAnterior).toBe(0);
    expect(body.movimientos[0].saldo).toBe(40);
  });

  it("filtra por el periodo indicado, inclusive en ambos extremos (C09, C10)", async () => {
    detailFindManyMock.mockResolvedValueOnce([]);

    const response = await GET(
      createRequest("?codigo=101&desde=2025-05-01&hasta=2025-05-31")
    );

    expect(response.status).toBe(200);
    const where = detailFindManyMock.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.entry).toEqual({
      entryDate: { gte: parseUtcDate("2025-05-01"), lte: parseUtcDate("2025-05-31") },
    });
    expect(where.accountId).toBe(1);
  });

  it("muestra los totales de los movimientos consultados (C11)", async () => {
    detailFindManyMock.mockResolvedValueOnce([
      createDetailRow({ id: 71, debit: 118, credit: 0 }),
      createDetailRow({ id: 72, debit: 0, credit: 60, description: "Cambio" }),
      createDetailRow({ id: 73, debit: 2, credit: 0, description: "Redondeo" }),
    ]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(body.totales).toEqual({ debe: 120, haber: 60, movimientos: 3 });
    expect(body.saldoFinal).toBe(60);
  });

  it("incluye el módulo y la referencia de la operación origen (C12)", async () => {
    detailFindManyMock.mockResolvedValueOnce([
      createDetailRow({
        id: 71,
        entryOverrides: {
          book: "Facturas de cliente",
          salesInvoice: { tipo_comprobante: "Factura", serie: "001", numero: 461 },
        },
      }),
      createDetailRow({
        id: 72,
        entryOverrides: {
          code: "COM/2025/05/0010",
          book: "Facturas de proveedor",
          salesInvoice: null,
          purchaseInvoice: { tipo_comprobante: "Factura", serie: "002", numero: 123 },
        },
      }),
      createDetailRow({
        id: 73,
        entryOverrides: {
          code: "PLAN/2025/06",
          book: "Operaciones varias",
          purchaseInvoice: null,
          payroll: { mes: 6, anio: 2025 },
        },
      }),
      createDetailRow({
        id: 74,
        entryOverrides: {
          code: "MISC/2025/06/0099",
          book: "Operaciones varias",
          salesInvoice: null,
        },
      }),
    ]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(
      body.movimientos.map(
        (m: { modulo: string; referencia: string | null }) => [
          m.modulo,
          m.referencia,
        ]
      )
    ).toEqual([
      ["Facturas de cliente", "Factura 001-461"],
      ["Facturas de proveedor", "Factura 002-123"],
      ["Operaciones varias", "Planilla 6/2025"],
      ["Operaciones varias", null],
    ]);
  });

  it("devuelve la lista vacía cuando no hay movimientos (C14)", async () => {
    detailFindManyMock.mockResolvedValueOnce([]);

    const response = await GET(
      createRequest("?codigo=101&desde=2030-01-01&hasta=2030-12-31")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.movimientos).toEqual([]);
    expect(body.totales).toEqual({ debe: 0, haber: 0, movimientos: 0 });
    expect(body.saldoFinal).toBe(body.saldoAnterior);
  });

  it("marca como Anulado un movimiento de asiento anulado", async () => {
    detailFindManyMock.mockResolvedValueOnce([createDetailRow({ entryOverrides: { status: false } })]);

    const body = await (await GET(createRequest("?codigo=101"))).json();

    expect(body.movimientos[0].estado).toBe("Anulado");
  });

  it("rechaza una fecha con formato inválido (C09)", async () => {
    const response = await GET(createRequest("?codigo=101&desde=31/05/2025"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "La fecha inicial debe tener el formato AAAA-MM-DD." });
    expect(detailFindManyMock).not.toHaveBeenCalled();
  });

  it("rechaza un periodo invertido (C09)", async () => {
    const response = await GET(createRequest("?codigo=101&desde=2025-06-30&hasta=2025-05-01"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "La fecha inicial no puede ser posterior a la fecha final.",
    });
    expect(detailFindManyMock).not.toHaveBeenCalled();
  });

  it("responde 500 si la consulta a la base falla", async () => {
    accountFindUniqueMock.mockRejectedValueOnce(new Error("sin conexión"));

    const response = await GET(createRequest("?codigo=101"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo obtener el libro mayor." });
  });
});
