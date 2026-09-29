import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { fechaUTC } from "@/lib/fechas";

// Los mocks se declaran con vi.hoisted porque vi.mock se evalúa antes que el
// resto del archivo: así se pueden usar directamente en las aserciones.
const { cuentaFindManyMock, createMock, generarCodigoMock } = vi.hoisted(() => ({
  cuentaFindManyMock: vi.fn(),
  createMock: vi.fn(),
  generarCodigoMock: vi.fn(),
}));

// Prisma y la numeración se sustituyen por mocks: estos tests no tocan la base
// de datos ni generan números reales.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cuenta_contable: { findMany: cuentaFindManyMock },
    asiento_contable: { create: createMock },
  },
}));

vi.mock("@/lib/codigo-asiento", () => ({
  generarCodigoAsiento: generarCodigoMock,
}));

import { POST } from "./route";

// Cuentas del catálogo de la pollería (ids de `cuenta_contable`).
const CAJA = 7;
const VENTAS = 21;
const IGV = 173;

/** Construye una petición POST real: el handler sólo lee `request.json()`. */
function solicitud(cuerpo: unknown): NextRequest {
  const texto = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return new Request("http://localhost/api/asientos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: texto,
  }) as unknown as NextRequest;
}

/** Cuerpo válido y cuadrado: 118 en el debe contra 100 + 18 en el haber. */
function cuerpoValido(sobrescribir: Record<string, unknown> = {}) {
  return {
    fecha: "2026-09-27",
    diario: "Facturas de cliente",
    glosa: "Venta mostrador F001-000461",
    responsable: "Leandro Mauricci",
    observacion: "Registrado desde el diálogo",
    lineas: [
      { idCuenta: CAJA, descripcion: "Cobro en efectivo", debe: 118, haber: 0 },
      { idCuenta: VENTAS, descripcion: "Venta de mercadería", debe: 0, haber: 100 },
      { idCuenta: IGV, descripcion: "IGV débito fiscal", debe: 0, haber: 18 },
    ],
    ...sobrescribir,
  };
}

/** Línea mínima válida para armar listas de relleno. */
function linea(indice: number) {
  return indice % 2 === 0
    ? { idCuenta: CAJA, debe: 1, haber: 0 }
    : { idCuenta: VENTAS, debe: 0, haber: 1 };
}

describe("POST /api/asientos (registrar asiento manual)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    generarCodigoMock.mockResolvedValue("MISC/2026/09/0001");
    cuentaFindManyMock.mockResolvedValue([
      { id_cuenta_contable: CAJA },
      { id_cuenta_contable: VENTAS },
      { id_cuenta_contable: IGV },
    ]);
    // Prisma devuelve la fila creada: el mock refleja los datos recibidos.
    createMock.mockImplementation(async (argumento: { data: Record<string, unknown> }) => ({
      id_asiento_contable: 501,
      ...argumento.data,
    }));
  });

  it("registra el asiento cuadrado y devuelve su resumen", async () => {
    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(cuerpo).toEqual({
      id: 501,
      numero: "MISC/2026/09/0001",
      fecha: "2026-09-27",
      diario: "Facturas de cliente",
      concepto: "Venta mostrador F001-000461",
      responsable: "Leandro Mauricci",
      estado: "Registrado",
      total: 118,
    });

    // El número lo genera el servidor a partir de la fecha contable
    expect(generarCodigoMock).toHaveBeenCalledTimes(1);
    expect(generarCodigoMock).toHaveBeenCalledWith(fechaUTC("2026-09-27"));

    expect(createMock).toHaveBeenCalledTimes(1);
    const { data } = createMock.mock.calls[0][0];
    expect(data).toMatchObject({
      codigo: "MISC/2026/09/0001",
      fecha_contable: fechaUTC("2026-09-27"),
      glosa: "Venta mostrador F001-000461",
      diario: "Facturas de cliente",
      responsable: "Leandro Mauricci",
      observacion: "Registrado desde el diálogo",
      estado: true,
    });
    expect(data.detalles_asiento.create).toEqual([
      { id_cuenta_contable: CAJA, descripcion: "Cobro en efectivo", debito: 118, credito: 0 },
      { id_cuenta_contable: VENTAS, descripcion: "Venta de mercadería", debito: 0, credito: 100 },
      { id_cuenta_contable: IGV, descripcion: "IGV débito fiscal", debito: 0, credito: 18 },
    ]);
  });

  it("consulta del plan sólo las cuentas distintas del asiento", async () => {
    await POST(
      solicitud(
        cuerpoValido({
          lineas: [
            { idCuenta: CAJA, debe: 118, haber: 0 },
            { idCuenta: CAJA, debe: 0, haber: 118 },
          ],
        })
      )
    );

    expect(cuentaFindManyMock).toHaveBeenCalledWith({
      where: { id_cuenta_contable: { in: [CAJA] } },
      select: { id_cuenta_contable: true },
    });
  });

  it("aplica los valores por defecto del diario, estado y textos opcionales", async () => {
    const respuesta = await POST(
      solicitud({
        fecha: "2026-09-27",
        glosa: "Ajuste por caja chica",
        lineas: [
          { idCuenta: CAJA, debe: 50, haber: 0 },
          { idCuenta: VENTAS, debe: 0, haber: 50 },
        ],
      })
    );
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(cuerpo).toMatchObject({
      diario: "Operaciones varias",
      estado: "Registrado",
      responsable: null,
      total: 50,
    });

    const { data } = createMock.mock.calls[0][0];
    expect(data).toMatchObject({ diario: "Operaciones varias", estado: true });
    expect(data.responsable).toBeNull();
    expect(data.observacion).toBeNull();
  });

  it("registra un asiento enviado como anulado", async () => {
    const respuesta = await POST(solicitud(cuerpoValido({ estado: false })));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(cuerpo.estado).toBe("Anulado");
    expect(createMock.mock.calls[0][0].data.estado).toBe(false);
  });

  it("acepta importes en texto, los redondea a 2 decimales y omite la descripción vacía", async () => {
    const respuesta = await POST(
      solicitud(
        cuerpoValido({
          lineas: [
            { idCuenta: CAJA, descripcion: "", debe: "10.567", haber: "" },
            { idCuenta: VENTAS, debe: 0, haber: "10.567" },
          ],
        })
      )
    );
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(cuerpo.total).toBe(10.57);
    expect(createMock.mock.calls[0][0].data.detalles_asiento.create).toEqual([
      { id_cuenta_contable: CAJA, descripcion: null, debito: 10.57, credito: 0 },
      { id_cuenta_contable: VENTAS, descripcion: null, debito: 0, credito: 10.57 },
    ]);
  });

  it("responde 400 si el cuerpo no es un JSON válido", async () => {
    const respuesta = await POST(solicitud("esto no es json"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(createMock).not.toHaveBeenCalled();
    expect(generarCodigoMock).not.toHaveBeenCalled();
  });

  it("responde 400 si el cuerpo es un arreglo", async () => {
    const respuesta = await POST(solicitud([]));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error).toBe("El cuerpo de la petición no es un JSON válido.");
    expect(createMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Validaciones de contenido
  // -------------------------------------------------------------------------
  type CasoValidacion = {
    caso: string;
    sobrescribir: Record<string, unknown>;
    mensaje: string;
  };

  const VALIDACIONES: CasoValidacion[] = [
    {
      caso: "la fecha viene vacía",
      sobrescribir: { fecha: "" },
      mensaje: "La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.",
    },
    {
      caso: "la fecha no tiene formato AAAA-MM-DD",
      sobrescribir: { fecha: "27/09/2026" },
      mensaje: "La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.",
    },
    {
      caso: "la glosa está vacía",
      sobrescribir: { glosa: "   " },
      mensaje: "El concepto (glosa) del asiento es obligatorio.",
    },
    {
      caso: "la glosa supera los 200 caracteres",
      sobrescribir: { glosa: "g".repeat(201) },
      mensaje: "El concepto no puede superar los 200 caracteres.",
    },
    {
      caso: "el diario supera los 60 caracteres",
      sobrescribir: { diario: "d".repeat(61) },
      mensaje: "El diario no puede superar los 60 caracteres.",
    },
    {
      caso: "el responsable supera los 100 caracteres",
      sobrescribir: { responsable: "r".repeat(101) },
      mensaje: "El responsable no puede superar los 100 caracteres.",
    },
    {
      caso: "la observación supera los 200 caracteres",
      sobrescribir: { observacion: "o".repeat(201) },
      mensaje: "La observación no puede superar los 200 caracteres.",
    },
    {
      caso: "el asiento trae una sola línea",
      sobrescribir: { lineas: [{ idCuenta: CAJA, debe: 100, haber: 0 }] },
      mensaje: "El asiento debe registrar al menos dos líneas (debe y haber).",
    },
    {
      caso: "el asiento trae más de 100 líneas",
      sobrescribir: { lineas: Array.from({ length: 101 }, (_, i) => linea(i)) },
      mensaje: "El asiento no puede superar las 100 líneas.",
    },
    {
      caso: "una línea no trae cuenta contable",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { debe: 0, haber: 100 },
        ],
      },
      mensaje: "Línea 2: falta la cuenta contable.",
    },
    {
      caso: "el id de la cuenta no es un entero",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { idCuenta: "cualquiera", debe: 0, haber: 100 },
        ],
      },
      mensaje: "Línea 2: falta la cuenta contable.",
    },
    {
      caso: "la línea no es un objeto",
      sobrescribir: {
        lineas: ["esto no es una línea", { idCuenta: CAJA, debe: 100, haber: 0 }],
      },
      mensaje: "Línea 1: el formato de la línea no es válido.",
    },
    {
      caso: "la descripción de la línea supera los 200 caracteres",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, descripcion: "d".repeat(201), debe: 100, haber: 0 },
          { idCuenta: VENTAS, debe: 0, haber: 100 },
        ],
      },
      mensaje: "Línea 1: la descripción no puede superar los 200 caracteres.",
    },
    {
      caso: "los importes no son números",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { idCuenta: VENTAS, debe: "mil", haber: 0 },
        ],
      },
      mensaje: "Línea 2: los importes deben ser números válidos.",
    },
    {
      caso: "los importes son negativos",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { idCuenta: VENTAS, debe: -50, haber: 0 },
        ],
      },
      mensaje: "Línea 2: los importes no pueden ser negativos.",
    },
    {
      caso: "la línea trae importe en debe y en haber",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { idCuenta: VENTAS, debe: 50, haber: 50 },
        ],
      },
      mensaje: "Línea 2: no puede tener importe en debe y en haber al mismo tiempo.",
    },
    {
      caso: "la línea no trae importes",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { idCuenta: VENTAS, debe: 0, haber: 0 },
        ],
      },
      mensaje: "Línea 2: debe tener un importe en debe o en haber.",
    },
    {
      caso: "el asiento no cuadra",
      sobrescribir: {
        lineas: [
          { idCuenta: CAJA, debe: 100, haber: 0 },
          { idCuenta: VENTAS, debe: 0, haber: 90 },
        ],
      },
      mensaje: "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00).",
    },
  ];

  it.each(VALIDACIONES)("rechaza con 400 cuando $caso", async ({ sobrescribir, mensaje }) => {
    const respuesta = await POST(solicitud(cuerpoValido(sobrescribir)));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error).toBe(mensaje);
    expect(cuerpo.errores).toContain(mensaje);

    // Ninguna validación llega a numerar ni a persistir el asiento
    expect(generarCodigoMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 400 si alguna línea apunta a una cuenta inexistente", async () => {
    // El plan sólo devuelve la primera de las cuentas pedidas
    cuentaFindManyMock.mockResolvedValue([{ id_cuenta_contable: CAJA }]);

    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({
      error: "Una o más cuentas contables del asiento no existen en el plan contable.",
    });
    expect(cuentaFindManyMock).toHaveBeenCalledWith({
      where: { id_cuenta_contable: { in: [CAJA, VENTAS, IGV] } },
      select: { id_cuenta_contable: true },
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(generarCodigoMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Numeración y errores de persistencia
  // -------------------------------------------------------------------------
  /** Error `P2002` (índice único) tal como lo lanza Prisma. */
  function codigoDuplicado(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codigo", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
  }

  it("reintenta con un número nuevo cuando el código está ocupado", async () => {
    generarCodigoMock
      .mockResolvedValueOnce("MISC/2026/09/0001")
      .mockResolvedValueOnce("MISC/2026/09/0002");
    createMock
      .mockRejectedValueOnce(codigoDuplicado())
      .mockResolvedValueOnce({
        id_asiento_contable: 502,
        codigo: "MISC/2026/09/0002",
        diario: "Facturas de cliente",
        glosa: "Venta mostrador F001-000461",
        responsable: "Leandro Mauricci",
        estado: true,
      });

    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(cuerpo.numero).toBe("MISC/2026/09/0002");

    // Cada intento vuelve a pedir un número libre
    expect(generarCodigoMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1][0].data.codigo).toBe("MISC/2026/09/0002");
  });

  it("responde 500 si los tres intentos chocan con el mismo número", async () => {
    createMock.mockRejectedValue(codigoDuplicado());

    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "No se pudo asignar un número de asiento, intente nuevamente.",
    });
    expect(createMock).toHaveBeenCalledTimes(3);
    expect(generarCodigoMock).toHaveBeenCalledTimes(3);
  });

  it("no reintenta ante un error de la base que no sea de código duplicado", async () => {
    createMock.mockRejectedValue(new Error("sin conexión"));

    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "No se pudo registrar el asiento contable.",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});
