import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fechaUTC } from "@/lib/fechas";

// Los mocks se declaran con vi.hoisted porque vi.mock se evalúa antes que el
// resto del archivo: así se pueden usar directamente en las aserciones.
const { countMock, findManyMock } = vi.hoisted(() => ({
  countMock: vi.fn(),
  findManyMock: vi.fn(),
}));

// Prisma se sustituye por mocks: estos tests no tocan la base de datos.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    asiento_contable: { count: countMock, findMany: findManyMock },
  },
}));

import { GET } from "./route";

/** Construye la mínima petición que necesita el handler (sólo lee `nextUrl`). */
function solicitud(consulta = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/diario${consulta}`),
  } as unknown as NextRequest;
}

/** Fila tal y como la devuelve `findMany` con el `select` del libro diario. */
function fila(id: number, fecha = "2025-06-18", estado = true) {
  return {
    id_asiento_contable: id,
    codigo: `MISC/2025/06/${String(id).padStart(4, "0")}`,
    fecha_contable: new Date(`${fecha}T00:00:00.000Z`),
    diario: "Operaciones varias",
    glosa: `Asiento ${id}`,
    responsable: "Leandro Mauricci",
    estado,
    detalles_asiento: [
      {
        id_detalle_asiento_contable: id * 10 + 1,
        descripcion: "Cobro en efectivo",
        debito: 118,
        credito: 0,
        cuenta_contable: { codigo: "101", nombre: "Caja", tipo: "Activo" },
      },
      {
        id_detalle_asiento_contable: id * 10 + 2,
        descripcion: "Venta de mercadería",
        debito: 0,
        credito: 100,
        cuenta_contable: { codigo: "701", nombre: "Ventas de Mercaderías", tipo: "Ingreso" },
      },
      {
        id_detalle_asiento_contable: id * 10 + 3,
        descripcion: "IGV débito fiscal",
        debito: 0,
        credito: 18,
        cuenta_contable: { codigo: "401", nombre: "Tributos por Pagar - IGV", tipo: "Pasivo" },
      },
    ],
  };
}

describe("GET /api/diario (libro diario)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve los asientos cronológicamente, del más reciente al más antiguo (C01)", async () => {
    countMock.mockResolvedValueOnce(2);
    findManyMock.mockResolvedValueOnce([fila(9, "2025-06-20"), fila(7, "2025-06-18")]);

    const respuesta = await GET(solicitud());
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.data.map((a: { fecha: string }) => a.fecha)).toEqual([
      "2025-06-20",
      "2025-06-18",
    ]);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ fecha_contable: "desc" }, { id_asiento_contable: "desc" }],
        skip: 0,
        take: 10,
      })
    );
  });

  it("incluye número, fecha y descripción de cada asiento (C02)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([fila(7)]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0]).toMatchObject({
      numero: "MISC/2025/06/0007",
      fecha: "2025-06-18",
      concepto: "Asiento 7",
      diario: "Operaciones varias",
      estado: "Registrado",
    });
  });

  it("lista las cuentas de cada línea con su código y nombre (C03)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([fila(7)]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0].lineas).toHaveLength(3);
    expect(cuerpo.data[0].lineas[0]).toMatchObject({
      cuentaCodigo: "101",
      cuentaNombre: "Caja",
      cuentaTipo: "Activo",
    });
    expect(cuerpo.data[0].lineas[2]).toMatchObject({
      cuentaCodigo: "401",
      cuentaNombre: "Tributos por Pagar - IGV",
    });
  });

  it("muestra cada importe en su columna Debe o Haber (C04)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([fila(7)]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0].lineas.map((l: { debe: number; haber: number }) => [l.debe, l.haber]))
      .toEqual([
        [118, 0],
        [0, 100],
        [0, 18],
      ]);
    expect(cuerpo.data[0].lineas[0].descripcion).toBe("Cobro en efectivo");
  });

  it("devuelve los totales de Debe y de Haber de cada asiento (C05) y su cuadre (C06)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([fila(7)]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0].totales).toEqual({ debe: 118, haber: 118 });
    expect(cuerpo.data[0].cuadrado).toBe(true);
  });

  it("marca como descuadrado un asiento cuyo Debe no coincide con su Haber (C06)", async () => {
    const descuadrado = fila(4);
    descuadrado.detalles_asiento[1].credito = 90;
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([descuadrado]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0].totales).toEqual({ debe: 118, haber: 108 });
    expect(cuerpo.data[0].cuadrado).toBe(false);
  });

  it("filtra por el periodo indicado, inclusive en ambos extremos (C07, C08)", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([fila(3, "2025-05-15")]);

    const respuesta = await GET(solicitud("?desde=2025-05-01&hasta=2025-05-31"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.meta).toMatchObject({ desde: "2025-05-01", hasta: "2025-05-31", total: 1 });

    const where = countMock.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.fecha_contable).toEqual({
      gte: fechaUTC("2025-05-01"),
      lte: fechaUTC("2025-05-31"),
    });
    // El listado se consulta con exactamente el mismo filtro
    expect(findManyMock.mock.calls[0][0].where).toEqual(where);
  });

  it("acepta un solo extremo del periodo y no filtra sin fechas (C07)", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await GET(solicitud("?desde=2025-05-01"));

    expect(countMock.mock.calls[0][0].where).toEqual({
      fecha_contable: { gte: fechaUTC("2025-05-01") },
    });

    countMock.mockClear();
    findManyMock.mockClear();
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await GET(solicitud());

    expect(countMock.mock.calls[0][0].where).toEqual({});
  });

  it("devuelve una lista vacía cuando no hay asientos en el periodo (C11)", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    const respuesta = await GET(solicitud("?desde=2030-01-01&hasta=2030-12-31"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.data).toEqual([]);
    expect(cuerpo.meta).toMatchObject({ total: 0, page: 1, totalPaginas: 1 });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
  });

  it("rechaza una fecha con formato inválido (C07)", async () => {
    const respuesta = await GET(solicitud("?desde=31/05/2025"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "La fecha inicial debe tener el formato AAAA-MM-DD." });
    expect(countMock).not.toHaveBeenCalled();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("rechaza un periodo invertido (C07)", async () => {
    const respuesta = await GET(solicitud("?desde=2025-06-30&hasta=2025-05-01"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({
      error: "La fecha inicial no puede ser posterior a la fecha final.",
    });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("normaliza página y tamaño de página inválidos", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([]);

    const cuerpo = await (await GET(solicitud("?page=abc&pageSize=9999"))).json();

    expect(cuerpo.meta).toMatchObject({ page: 1, pageSize: 100, totalPaginas: 1 });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 100 });
  });

  it("recorta la página pedida cuando el total no llega", async () => {
    countMock.mockResolvedValueOnce(2);
    findManyMock.mockResolvedValueOnce([]);

    const cuerpo = await (await GET(solicitud("?page=5&pageSize=10"))).json();

    expect(cuerpo.meta).toMatchObject({ page: 1, totalPaginas: 1 });
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });
  });

  it("marca como Anulado un asiento con estado false", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([fila(9, "2025-06-18", false)]);

    const cuerpo = await (await GET(solicitud())).json();

    expect(cuerpo.data[0].estado).toBe("Anulado");
  });

  it("responde 500 si la consulta a la base falla", async () => {
    countMock.mockRejectedValueOnce(new Error("sin conexión"));

    const respuesta = await GET(solicitud());
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No se pudo obtener el libro diario." });
  });
});
