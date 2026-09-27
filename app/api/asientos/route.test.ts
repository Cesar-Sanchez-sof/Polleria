import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fechaUTC } from "@/lib/fechas";

// Los mocks se declaran con vi.hoisted porque vi.mock se evalúa antes que el
// resto del archivo: así se pueden usar directamente en las aserciones.
const { countMock, findManyMock, groupByMock } = vi.hoisted(() => ({
  countMock: vi.fn(),
  findManyMock: vi.fn(),
  groupByMock: vi.fn(),
}));

// Prisma se sustituye por mocks: estos tests no tocan la base de datos.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    asiento_contable: { count: countMock, findMany: findManyMock },
    detalle_asiento_contable: { groupBy: groupByMock },
  },
}));

import { GET } from "./route";

/** Construye la mínima petición que necesita el handler (sólo lee `nextUrl`). */
function solicitud(consulta = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/asientos${consulta}`),
  } as unknown as NextRequest;
}

/** Fila tal y como la devuelve `findMany` con el `select` del listado. */
function fila(id: number, total: number, estado = true) {
  return {
    id_asiento_contable: id,
    codigo: `MISC/2025/06/${String(id).padStart(4, "0")}`,
    fecha_contable: new Date("2025-06-18T00:00:00.000Z"),
    diario: "Operaciones varias",
    glosa: `Asiento ${id}`,
    responsable: "Leandro Mauricci",
    estado,
    detalles_asiento: [{ debito: total }],
  };
}

/** Encadena los tres conteos que lanza el handler (total, registrados, anulados). */
function responderConteos(total: number, registrados: number, anulados: number) {
  countMock
    .mockResolvedValueOnce(total)
    .mockResolvedValueOnce(registrados)
    .mockResolvedValueOnce(anulados);
}

describe("GET /api/asientos (listar asientos)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve las filas mapeadas y la meta de paginación", async () => {
    responderConteos(36, 30, 6);
    findManyMock.mockResolvedValueOnce([fila(7, 300.25)]);

    const respuesta = await GET(solicitud());
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.data).toEqual([
      {
        id: 7,
        numero: "MISC/2025/06/0007",
        fecha: "2025-06-18",
        diario: "Operaciones varias",
        concepto: "Asiento 7",
        responsable: "Leandro Mauricci",
        estado: "Registrado",
        // El total es la suma del debe de sus líneas
        total: 300.25,
      },
    ]);
    expect(cuerpo.meta).toEqual({
      total: 36,
      registrados: 30,
      anulados: 6,
      page: 1,
      pageSize: 10,
      totalPaginas: 4,
      orden: "fecha",
      dir: "desc",
    });

    // Los tres conteos comparten el filtro base (total y por estado)
    expect(countMock).toHaveBeenNthCalledWith(1, { where: {} });
    expect(countMock).toHaveBeenNthCalledWith(2, { where: { AND: [{}, { estado: true }] } });
    expect(countMock).toHaveBeenNthCalledWith(3, { where: { AND: [{}, { estado: false }] } });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ fecha_contable: "desc" }, { id_asiento_contable: "desc" }],
        select: expect.objectContaining({
          id_asiento_contable: true,
          detalles_asiento: { select: { debito: true } },
        }),
      })
    );
  });

  it("combina todos los filtros en un solo where (AND)", async () => {
    responderConteos(1, 0, 1);
    findManyMock.mockResolvedValueOnce([]);

    const respuesta = await GET(
      solicitud(
        "?desde=2025-05-01&hasta=2025-06-30&diario=Banco%20%2F%20Caja&estado=anulado&q=caja"
      )
    );
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.meta.total).toBe(1);

    const filtro = countMock.mock.calls[0][0].where as Record<string, unknown>;
    expect(filtro).toMatchObject({
      diario: "Banco / Caja",
      estado: false,
      fecha_contable: {
        gte: fechaUTC("2025-05-01"),
        lte: fechaUTC("2025-06-30"),
      },
    });
    // Búsqueda libre: número/referencia, glosa o cuenta contable
    expect(filtro.OR).toEqual([
      { codigo: { contains: "caja", mode: "insensitive" } },
      { glosa: { contains: "caja", mode: "insensitive" } },
      {
        detalles_asiento: {
          some: {
            cuenta_contable: {
              OR: [
                { codigo: { contains: "caja", mode: "insensitive" } },
                { nombre: { contains: "caja", mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ]);

    // El listado se consulta con exactamente el mismo filtro
    expect(findManyMock.mock.calls[0][0].where).toEqual(filtro);
    expect(countMock.mock.calls[1][0].where).toEqual({
      AND: [filtro, { estado: true }],
    });
  });

  it("marca el filtro de estado registrado sin alterar el conteo total", async () => {
    responderConteos(12, 12, 0);
    findManyMock.mockResolvedValueOnce([]);

    await GET(solicitud("?estado=registrado"));

    expect(countMock.mock.calls[0][0].where).toMatchObject({ estado: true });
    expect(countMock.mock.calls[1][0].where).toEqual({
      AND: [{ estado: true }, { estado: true }],
    });
  });

  it("normaliza página, tamaño, orden y dirección inválidos", async () => {
    responderConteos(1, 1, 0);
    findManyMock.mockResolvedValueOnce([]);

    const respuesta = await GET(solicitud("?page=abc&pageSize=9999&orden=inventado&dir=ASC"));
    const cuerpo = await respuesta.json();

    expect(cuerpo.meta).toEqual({
      total: 1,
      registrados: 1,
      anulados: 0,
      page: 1,
      pageSize: 100, // tope de 100 por página
      totalPaginas: 1,
      orden: "fecha", // orden desconocido → por defecto
      dir: "desc", // dirección no válida → descendente
    });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 100 });
  });

  it("recorta la página pedida cuando el total no llega", async () => {
    responderConteos(2, 1, 1);
    findManyMock.mockResolvedValueOnce([]);

    const cuerpo = await (await GET(solicitud("?page=5&pageSize=10"))).json();

    expect(cuerpo.meta).toMatchObject({ page: 1, totalPaginas: 1 });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });
  });

  it("ordena por total agregando el debe de cada asiento", async () => {
    responderConteos(3, 2, 1);
    findManyMock
      // 1ª llamada: sólo los ids para calcular el orden
      .mockResolvedValueOnce([
        { id_asiento_contable: 1 },
        { id_asiento_contable: 2 },
        { id_asiento_contable: 3 },
      ])
      // 2ª llamada: las filas de la página, en orden arbitrario
      .mockResolvedValueOnce([fila(3, 200), fila(1, 300), fila(2, 100)]);
    groupByMock.mockResolvedValueOnce([
      { id_asiento_contable: 1, _sum: { debito: 300 } },
      { id_asiento_contable: 2, _sum: { debito: 100 } },
      { id_asiento_contable: 3, _sum: { debito: 200 } },
    ]);

    const cuerpo = await (await GET(solicitud("?orden=total&dir=asc"))).json();

    expect(groupByMock).toHaveBeenCalledWith({
      by: ["id_asiento_contable"],
      where: { id_asiento_contable: { in: [1, 2, 3] } },
      _sum: { debito: true },
    });
    expect(cuerpo.meta).toMatchObject({ orden: "total", dir: "asc" });
    expect(cuerpo.data.map((asiento: { id: number }) => asiento.id)).toEqual([2, 3, 1]);

    // La página se pide ya con los ids ordenados (sin skip/take ni orderBy)
    expect(findManyMock.mock.calls[1][0]).toMatchObject({
      where: { AND: [{}, { id_asiento_contable: { in: [2, 3, 1] } }] },
      orderBy: undefined,
      skip: undefined,
      take: undefined,
    });
  });

  it("marca como Anulado un asiento con estado false", async () => {
    responderConteos(1, 0, 1);
    findManyMock.mockResolvedValueOnce([fila(9, 50, false)]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0].estado).toBe("Anulado");
  });

  it("responde 500 si la consulta a la base falla", async () => {
    countMock.mockRejectedValueOnce(new Error("sin conexión"));

    const respuesta = await GET(solicitud());
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No se pudo obtener el listado de asientos contables." });
  });
});
