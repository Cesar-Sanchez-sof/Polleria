import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { parseUtcDate } from "@/lib/dates";

const { countMock, findManyMock } = vi.hoisted(() => ({
  countMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    journalEntry: { count: countMock, findMany: findManyMock },
  },
}));

import { GET } from "./route";

function createRequest(query = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/daily-book${query}`),
  } as unknown as NextRequest;
}

function createEntryRow(id: number, dateStr = "2025-06-18", status = true) {
  return {
    id,
    code: `MISC/2025/06/${String(id).padStart(4, "0")}`,
    entryDate: new Date(`${dateStr}T00:00:00.000Z`),
    book: "Operaciones varias",
    description: `Asiento ${id}`,
    responsible: "Leandro Mauricci",
    status,
    entryDetails: [
      {
        id: id * 10 + 1,
        description: "Cobro en efectivo",
        debit: 118,
        credit: 0,
        account: { code: "101", name: "Caja", type: "Activo" },
      },
      {
        id: id * 10 + 2,
        description: "Venta de mercadería",
        debit: 0,
        credit: 100,
        account: { code: "701", name: "Ventas de Mercaderías", type: "Ingreso" },
      },
      {
        id: id * 10 + 3,
        description: "IGV débito fiscal",
        debit: 0,
        credit: 18,
        account: { code: "401", name: "Tributos por Pagar - IGV", type: "Pasivo" },
      },
    ],
  };
}

describe("GET /api/daily-book (libro diario)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve los asientos cronológicamente, del más reciente al más antiguo (C01)", async () => {
    countMock.mockResolvedValueOnce(2);
    findManyMock.mockResolvedValueOnce([createEntryRow(9, "2025-06-20"), createEntryRow(7, "2025-06-18")]);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((a: { fecha: string }) => a.fecha)).toEqual([
      "2025-06-20",
      "2025-06-18",
    ]);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ entryDate: "desc" }, { id: "desc" }],
        skip: 0,
        take: 10,
      })
    );
  });

  it("incluye número, fecha y descripción de cada asiento (C02)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([createEntryRow(7)]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0]).toMatchObject({
      numero: "MISC/2025/06/0007",
      fecha: "2025-06-18",
      concepto: "Asiento 7",
      diario: "Operaciones varias",
      estado: "Registrado",
    });
  });

  it("lista las cuentas de cada línea con su código y nombre (C03)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([createEntryRow(7)]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0].lineas).toHaveLength(3);
    expect(body.data[0].lineas[0]).toMatchObject({
      cuentaCodigo: "101",
      cuentaNombre: "Caja",
      cuentaTipo: "Activo",
    });
    expect(body.data[0].lineas[2]).toMatchObject({
      cuentaCodigo: "401",
      cuentaNombre: "Tributos por Pagar - IGV",
    });
  });

  it("muestra cada importe en su columna Debe o Haber (C04)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([createEntryRow(7)]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0].lineas.map((l: { debe: number; haber: number }) => [l.debe, l.haber])).toEqual([
      [118, 0],
      [0, 100],
      [0, 18],
    ]);
    expect(body.data[0].lineas[0].descripcion).toBe("Cobro en efectivo");
  });

  it("devuelve los totales de Debe y de Haber de cada asiento (C05) y su cuadre (C06)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([createEntryRow(7)]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0].totales).toEqual({ debe: 118, haber: 118 });
    expect(body.data[0].cuadrado).toBe(true);
  });

  it("marca como descuadrado un asiento cuyo Debe no coincide con su Haber (C06)", async () => {
    const unadjusted = createEntryRow(4);
    unadjusted.entryDetails[1].credit = 90;
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([unadjusted]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0].totales).toEqual({ debe: 118, haber: 108 });
    expect(body.data[0].cuadrado).toBe(false);
  });

  it("filtra por el periodo indicado, inclusive en ambos extremos (C07, C08)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([createEntryRow(3, "2025-05-15")]);

    const response = await GET(createRequest("?desde=2025-05-01&hasta=2025-05-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta).toMatchObject({ desde: "2025-05-01", hasta: "2025-05-31", total: 1 });

    const where = countMock.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.entryDate).toEqual({
      gte: parseUtcDate("2025-05-01"),
      lte: parseUtcDate("2025-05-31"),
    });
    expect(findManyMock.mock.calls[0][0].where).toEqual(where);
  });

  it("acepta un solo extremo del periodo y no filtra sin fechas (C07)", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await GET(createRequest("?desde=2025-05-01"));

    expect(countMock.mock.calls[0][0].where).toEqual({
      entryDate: { gte: parseUtcDate("2025-05-01") },
    });

    countMock.mockClear();
    findManyMock.mockClear();
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await GET(createRequest());

    expect(countMock.mock.calls[0][0].where).toEqual({});
  });

  it("devuelve una lista vacía cuando no hay asientos en el periodo (C11)", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    const response = await GET(createRequest("?desde=2030-01-01&hasta=2030-12-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta).toMatchObject({ total: 0, page: 1, totalPaginas: 1 });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
  });

  it("rechaza una fecha con formato inválido (C07)", async () => {
    const response = await GET(createRequest("?desde=31/05/2025"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "La fecha inicial debe tener el formato AAAA-MM-DD." });
    expect(countMock).not.toHaveBeenCalled();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("rechaza un periodo invertido (C07)", async () => {
    const response = await GET(createRequest("?desde=2025-06-30&hasta=2025-05-01"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "La fecha inicial no puede ser posterior a la fecha final.",
    });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("normaliza página y tamaño de página inválidos", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([]);

    const body = await (await GET(createRequest("?page=abc&pageSize=9999"))).json();

    expect(body.meta).toMatchObject({ page: 1, pageSize: 100, totalPaginas: 1 });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 100 });
  });

  it("recorta la página pedida cuando el total no llega", async () => {
    countMock.mockResolvedValueOnce(2);
    findManyMock.mockResolvedValueOnce([]);

    const body = await (await GET(createRequest("?page=5&pageSize=10"))).json();

    expect(body.meta).toMatchObject({ page: 1, totalPaginas: 1 });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });
  });

  it("marca como Anulado un asiento con estado false", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([createEntryRow(9, "2025-06-18", false)]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0].estado).toBe("Anulado");
  });

  it("responde 500 si la consulta a la base falla", async () => {
    countMock.mockRejectedValueOnce(new Error("sin conexión"));

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo obtener el libro diario." });
  });
});
