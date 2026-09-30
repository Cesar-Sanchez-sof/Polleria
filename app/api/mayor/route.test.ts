import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fechaUTC } from "@/lib/fechas";

// Los mocks se declaran con vi.hoisted porque vi.mock se evalúa antes que el
// resto del archivo: así se pueden usar directamente en las aserciones.
const { cuentaFindUniqueMock, detalleAggregateMock, detalleFindManyMock } = vi.hoisted(
  () => ({
    cuentaFindUniqueMock: vi.fn(),
    detalleAggregateMock: vi.fn(),
    detalleFindManyMock: vi.fn(),
  })
);

// Prisma se sustituye por mocks: estos tests no tocan la base de datos.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cuenta_contable: { findUnique: cuentaFindUniqueMock },
    detalle_asiento_contable: {
      aggregate: detalleAggregateMock,
      findMany: detalleFindManyMock,
    },
  },
}));

import { GET } from "./route";

/** Construye la mínima petición que necesita el handler (sólo lee `nextUrl`). */
function solicitud(consulta = ""): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/mayor${consulta}`),
  } as unknown as NextRequest;
}

/** Cuenta tal y como la devuelve `findUnique`. */
function cuenta() {
  return { id_cuenta_contable: 1, codigo: "101", nombre: "Caja", tipo: "Activo" };
}

/** Movimiento tal y como lo devuelve `findMany` con el `select` del libro mayor. */
function fila({
  id = 71,
  idAsiento = 7,
  fecha = "2025-06-18",
  debito = 118,
  credito = 0,
  descripcion = "Cobro en efectivo",
  asiento = {},
}: {
  id?: number;
  idAsiento?: number;
  fecha?: string;
  debito?: number;
  credito?: number;
  descripcion?: string;
  asiento?: Record<string, unknown>;
} = {}) {
  return {
    id_detalle_asiento_contable: id,
    descripcion,
    debito,
    credito,
    asiento_contable: {
      id_asiento_contable: idAsiento,
      codigo: `MISC/2025/06/${String(idAsiento).padStart(4, "0")}`,
      fecha_contable: new Date(`${fecha}T00:00:00.000Z`),
      glosa: "Venta mostrador",
      diario: "Facturas de cliente",
      estado: true,
      comprobante_venta: null,
      comprobante_compra: null,
      planilla: null,
      ...asiento,
    },
  };
}

describe("GET /api/mayor (libro mayor)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    cuentaFindUniqueMock.mockResolvedValue(cuenta());
    detalleAggregateMock.mockResolvedValue({ _sum: { debito: 0, credito: 0 } });
    detalleFindManyMock.mockResolvedValue([]);
  });

  it("exige la cuenta contable a consultar (C01)", async () => {
    const respuesta = await GET(solicitud(""));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "Debe indicar la cuenta contable a consultar." });
    expect(cuentaFindUniqueMock).not.toHaveBeenCalled();
    expect(detalleFindManyMock).not.toHaveBeenCalled();
  });

  it("responde 404 si la cuenta no existe (C01)", async () => {
    cuentaFindUniqueMock.mockResolvedValueOnce(null);

    const respuesta = await GET(solicitud("?codigo=999"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(404);
    expect(cuerpo).toEqual({ error: "Cuenta contable no encontrada." });
    expect(detalleFindManyMock).not.toHaveBeenCalled();
  });

  it("devuelve el código y la denominación de la cuenta (C02)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([fila()]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(cuentaFindUniqueMock).toHaveBeenCalledWith({ where: { codigo: "101" } });
    expect(cuerpo.cuenta).toEqual({ codigo: "101", nombre: "Caja", tipo: "Activo" });
  });

  it("consulta los movimientos ordenados cronológicamente (C03)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([]);

    await GET(solicitud("?codigo=101"));

    expect(detalleFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { asiento_contable: { fecha_contable: "asc" } },
          { asiento_contable: { id_asiento_contable: "asc" } },
          { id_detalle_asiento_contable: "asc" },
        ],
      })
    );
  });

  it("devuelve fecha, número de asiento y glosa de cada movimiento (C04-C06)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([
      fila({ idAsiento: 3, fecha: "2025-06-18", descripcion: "Cobro en efectivo" }),
    ]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(cuerpo.movimientos[0]).toMatchObject({
      id: 71,
      idAsiento: 3,
      numero: "MISC/2025/06/0003",
      fecha: "2025-06-18",
      glosa: "Venta mostrador",
      descripcion: "Cobro en efectivo",
    });
  });

  it("coloca el importe en Debe o en Haber según corresponda (C07)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([
      fila({ id: 71, debito: 118, credito: 0 }),
      fila({ id: 72, debito: 0, credito: 118, descripcion: "Venta mercadería" }),
    ]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(
      cuerpo.movimientos.map((m: { debe: number; haber: number }) => [m.debe, m.haber])
    ).toEqual([
      [118, 0],
      [0, 118],
    ]);
  });

  it("calcula el saldo después de cada movimiento y si es deudor o acreedor (C08)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([
      fila({ id: 71, debito: 118, credito: 0 }),
      fila({ id: 72, debito: 0, credito: 200, descripcion: "Pago proveedor" }),
    ]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(
      cuerpo.movimientos.map(
        (m: { saldo: number; tipoSaldo: string | null }) => [m.saldo, m.tipoSaldo]
      )
    ).toEqual([
      [118, "deudor"],
      [-82, "acreedor"],
    ]);
    expect(cuerpo.saldoFinal).toBe(-82);
  });

  it("parte del saldo anterior al periodo cuando se filtra (C08, C09)", async () => {
    detalleAggregateMock.mockResolvedValueOnce({
      _sum: { debito: "350", credito: "200" },
    });
    detalleFindManyMock.mockResolvedValueOnce([fila({ debito: 50, credito: 0 })]);

    const cuerpo = await (await GET(solicitud("?codigo=101&desde=2025-06-01"))).json();

    // Saldo anterior = 350 - 200 = 150; con el movimiento de 50 queda en 200
    expect(detalleAggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_cuenta_contable: 1,
          asiento_contable: { fecha_contable: { lt: fechaUTC("2025-06-01") } },
        },
      })
    );
    expect(cuerpo.saldoAnterior).toBe(150);
    expect(cuerpo.movimientos[0].saldo).toBe(200);
    expect(cuerpo.saldoFinal).toBe(200);
  });

  it("toma el saldo anterior en 0 cuando no hay fecha inicial (C08)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([fila({ debito: 40, credito: 0 })]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(detalleAggregateMock).not.toHaveBeenCalled();
    expect(cuerpo.saldoAnterior).toBe(0);
    expect(cuerpo.movimientos[0].saldo).toBe(40);
  });

  it("filtra por el periodo indicado, inclusive en ambos extremos (C09, C10)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([]);

    const respuesta = await GET(
      solicitud("?codigo=101&desde=2025-05-01&hasta=2025-05-31")
    );

    expect(respuesta.status).toBe(200);
    const where = detalleFindManyMock.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.asiento_contable).toEqual({
      fecha_contable: { gte: fechaUTC("2025-05-01"), lte: fechaUTC("2025-05-31") },
    });
    expect(where.id_cuenta_contable).toBe(1);
  });

  it("muestra los totales de los movimientos consultados (C11)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([
      fila({ id: 71, debito: 118, credito: 0 }),
      fila({ id: 72, debito: 0, credito: 60, descripcion: "Cambio" }),
      fila({ id: 73, debito: 2, credito: 0, descripcion: "Redondeo" }),
    ]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(cuerpo.totales).toEqual({ debe: 120, haber: 60, movimientos: 3 });
    expect(cuerpo.saldoFinal).toBe(60);
  });

  it("incluye el módulo y la referencia de la operación origen (C12)", async () => {
    detalleFindManyMock.mockResolvedValueOnce([
      fila({
        id: 71,
        asiento: {
          diario: "Facturas de cliente",
          comprobante_venta: { tipo_comprobante: "Factura", serie: "001", numero: 461 },
        },
      }),
      fila({
        id: 72,
        asiento: {
          codigo: "COM/2025/05/0010",
          diario: "Facturas de proveedor",
          comprobante_venta: null,
          comprobante_compra: { tipo_comprobante: "Factura", serie: "002", numero: 123 },
        },
      }),
      fila({
        id: 73,
        asiento: {
          codigo: "PLAN/2025/06",
          diario: "Operaciones varias",
          comprobante_compra: null,
          planilla: { mes: 6, anio: 2025 },
        },
      }),
      fila({
        id: 74,
        asiento: {
          codigo: "MISC/2025/06/0099",
          diario: "Operaciones varias",
          comprobante_venta: null,
        },
      }),
    ]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(
      cuerpo.movimientos.map(
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
    detalleFindManyMock.mockResolvedValueOnce([]);

    const respuesta = await GET(
      solicitud("?codigo=101&desde=2030-01-01&hasta=2030-12-31")
    );
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.movimientos).toEqual([]);
    expect(cuerpo.totales).toEqual({ debe: 0, haber: 0, movimientos: 0 });
    expect(cuerpo.saldoFinal).toBe(cuerpo.saldoAnterior);
  });

  it("marca como Anulado un movimiento de asiento anulado", async () => {
    detalleFindManyMock.mockResolvedValueOnce([fila({ asiento: { estado: false } })]);

    const cuerpo = await (await GET(solicitud("?codigo=101"))).json();

    expect(cuerpo.movimientos[0].estado).toBe("Anulado");
  });

  it("rechaza una fecha con formato inválido (C09)", async () => {
    const respuesta = await GET(solicitud("?codigo=101&desde=31/05/2025"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "La fecha inicial debe tener el formato AAAA-MM-DD." });
    expect(detalleFindManyMock).not.toHaveBeenCalled();
  });

  it("rechaza un periodo invertido (C09)", async () => {
    const respuesta = await GET(solicitud("?codigo=101&desde=2025-06-30&hasta=2025-05-01"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({
      error: "La fecha inicial no puede ser posterior a la fecha final.",
    });
    expect(detalleFindManyMock).not.toHaveBeenCalled();
  });

  it("responde 500 si la consulta a la base falla", async () => {
    cuentaFindUniqueMock.mockRejectedValueOnce(new Error("sin conexión"));

    const respuesta = await GET(solicitud("?codigo=101"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No se pudo obtener el libro mayor." });
  });
});
