import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { parseUtcDate } from "@/lib/fechas";

const { countMock, findManyMock, groupByMock } = vi.hoisted(() => ({
  countMock: vi.fn(),
  findManyMock: vi.fn(),
  groupByMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    journalEntry: { count: countMock, findMany: findManyMock },
    journalEntryDetail: { groupBy: groupByMock },
  },
}));

import { GET } from "./route";

function createRequest(queryString = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/asientos${queryString}`),
  } as unknown as NextRequest;
}

function createEntryRow(id: number, total: number, status = true) {
  return {
    id,
    code: `MISC/2025/06/${String(id).padStart(4, "0")}`,
    entryDate: new Date("2025-06-18T00:00:00.000Z"),
    book: "Operaciones varias",
    description: `Asiento ${id}`,
    responsible: "Leandro Mauricci",
    status,
    entryDetails: [{ debit: total }],
  };
}

function mockCounts(total: number, registered: number, annulled: number) {
  countMock
    .mockResolvedValueOnce(total)
    .mockResolvedValueOnce(registered)
    .mockResolvedValueOnce(annulled);
}

describe("GET /api/asientos (listar asientos)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve las filas mapeadas y la meta de paginación", async () => {
    mockCounts(36, 30, 6);
    findManyMock.mockResolvedValueOnce([createEntryRow(7, 300.25)]);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        id: 7,
        numero: "MISC/2025/06/0007",
        fecha: "2025-06-18",
        diario: "Operaciones varias",
        concepto: "Asiento 7",
        responsable: "Leandro Mauricci",
        estado: "Registrado",
        total: 300.25,
      },
    ]);
    expect(body.meta).toEqual({
      total: 36,
      registrados: 30,
      anulados: 6,
      page: 1,
      pageSize: 10,
      totalPaginas: 4,
      orden: "fecha",
      dir: "desc",
    });

    expect(countMock).toHaveBeenNthCalledWith(1, { where: {} });
    expect(countMock).toHaveBeenNthCalledWith(2, { where: { AND: [{}, { status: true }] } });
    expect(countMock).toHaveBeenNthCalledWith(3, { where: { AND: [{}, { status: false }] } });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ entryDate: "desc" }, { id: "desc" }],
        select: expect.objectContaining({
          id: true,
          entryDetails: { select: { debit: true } },
        }),
      })
    );
  });

  it("combina todos los filtros en un solo where (AND)", async () => {
    mockCounts(1, 0, 1);
    findManyMock.mockResolvedValueOnce([]);

    const response = await GET(
      createRequest("?desde=2025-05-01&hasta=2025-06-30&diario=Banco%20%2F%20Caja&estado=anulado&q=caja")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.total).toBe(1);

    const filter = countMock.mock.calls[0][0].where as Record<string, unknown>;
    expect(filter).toMatchObject({
      book: "Banco / Caja",
      status: false,
      entryDate: {
        gte: parseUtcDate("2025-05-01"),
        lte: parseUtcDate("2025-06-30"),
      },
    });

    expect(filter.OR).toEqual([
      { code: { contains: "caja", mode: "insensitive" } },
      { description: { contains: "caja", mode: "insensitive" } },
      {
        entryDetails: {
          some: {
            account: {
              OR: [
                { code: { contains: "caja", mode: "insensitive" } },
                { name: { contains: "caja", mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ]);

    expect(findManyMock.mock.calls[0][0].where).toEqual(filter);
    expect(countMock.mock.calls[1][0].where).toEqual({
      AND: [filter, { status: true }],
    });
  });

  it("marca el filtro de estado registrado sin alterar el conteo total", async () => {
    mockCounts(12, 12, 0);
    findManyMock.mockResolvedValueOnce([]);

    await GET(createRequest("?estado=registrado"));

    expect(countMock.mock.calls[0][0].where).toMatchObject({ status: true });
    expect(countMock.mock.calls[1][0].where).toEqual({
      AND: [{ status: true }, { status: true }],
    });
  });

  it("normaliza página, tamaño, orden y dirección inválidos", async () => {
    mockCounts(1, 1, 0);
    findManyMock.mockResolvedValueOnce([]);

    const response = await GET(createRequest("?page=abc&pageSize=9999&orden=inventado&dir=ASC"));
    const body = await response.json();

    expect(body.meta).toEqual({
      total: 1,
      registrados: 1,
      anulados: 0,
      page: 1,
      pageSize: 100,
      totalPaginas: 1,
      orden: "fecha",
      dir: "desc",
    });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 100 });
  });

  it("recorta la página pedida cuando el total no llega", async () => {
    mockCounts(2, 1, 1);
    findManyMock.mockResolvedValueOnce([]);

    const body = await (await GET(createRequest("?page=5&pageSize=10"))).json();

    expect(body.meta).toMatchObject({ page: 1, totalPaginas: 1 });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });
  });

  it("ordena por total agregando el debe de cada asiento", async () => {
    mockCounts(3, 2, 1);
    findManyMock
      .mockResolvedValueOnce([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ])
      .mockResolvedValueOnce([createEntryRow(3, 200), createEntryRow(1, 300), createEntryRow(2, 100)]);
    groupByMock.mockResolvedValueOnce([
      { entryId: 1, _sum: { debit: 300 } },
      { entryId: 2, _sum: { debit: 100 } },
      { entryId: 3, _sum: { debit: 200 } },
    ]);

    const body = await (await GET(createRequest("?orden=total&dir=asc"))).json();

    expect(groupByMock).toHaveBeenCalledWith({
      by: ["entryId"],
      where: { entryId: { in: [1, 2, 3] } },
      _sum: { debit: true },
    });
    expect(body.meta).toMatchObject({ orden: "total", dir: "asc" });
    expect(body.data.map((asiento: { id: number }) => asiento.id)).toEqual([2, 3, 1]);

    expect(findManyMock.mock.calls[1][0]).toMatchObject({
      where: { AND: [{}, { id: { in: [2, 3, 1] } }] },
      orderBy: undefined,
      skip: undefined,
      take: undefined,
    });
  });

  it("marca como Anulado un asiento con estado false", async () => {
    mockCounts(1, 0, 1);
    findManyMock.mockResolvedValueOnce([createEntryRow(9, 50, false)]);

    const body = await (await GET(createRequest())).json();

    expect(body.data[0].estado).toBe("Anulado");
  });

  it("responde 500 si la consulta a la base falla", async () => {
    countMock.mockRejectedValueOnce(new Error("sin conexión"));

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo obtener el listado de asientos contables." });
  });
});
