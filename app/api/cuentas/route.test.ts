import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

// Los mocks se declaran con vi.hoisted porque vi.mock se evalúa antes que el
// resto del archivo: así se pueden usar directamente en las aserciones.
const { findManyMock, findUniqueMock, createMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
}));

// Prisma se sustituye por mocks: estos tests no tocan la base de datos.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cuenta_contable: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      create: createMock,
    },
  },
}));

import { GET, POST } from "./route";

/** Construye la mínima petición que necesita el handler (sólo lee `json()`). */
function solicitud(cuerpo: unknown): NextRequest {
  const texto = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return new Request("http://localhost/api/cuentas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: texto,
  }) as unknown as NextRequest;
}

/** Cuerpo válido y completo para dar de alta una cuenta. */
function cuerpoValido(sobrescribir: Record<string, unknown> = {}) {
  return {
    codigo: "10101",
    nombre: "Caja chica",
    tipo: "Activo",
    ...sobrescribir,
  };
}

/** Fila tal y como la devuelve el `select` compartido de las rutas. */
function fila(
  id: number,
  codigo: string,
  opciones: {
    nombre?: string;
    tipo?: string;
    idPadre?: number | null;
    activo?: boolean;
    usos?: number;
  } = {}
) {
  return {
    id_cuenta_contable: id,
    codigo,
    nombre: opciones.nombre ?? `Cuenta ${codigo}`,
    tipo: opciones.tipo ?? "Activo",
    id_cuenta_padre: opciones.idPadre ?? null,
    activo: opciones.activo ?? true,
    _count: { detalles_asiento: opciones.usos ?? 0 },
  };
}

/** Configura `findUnique` para el chequeo de código y la consulta del padre. */
function conBusquedas({
  codigoExistente = null,
  padre = null,
}: {
  codigoExistente?: { id_cuenta_contable: number } | null;
  padre?: { id_cuenta_contable: number; tipo: string; activo: boolean } | null;
} = {}) {
  findUniqueMock.mockImplementation(
    async (argumento: { where: Record<string, unknown> }) =>
      "codigo" in argumento.where ? codigoExistente : padre
  );
}

describe("GET /api/cuentas (listar el plan contable)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve todas las cuentas con su jerarquía y su uso", async () => {
    findManyMock.mockResolvedValue([
      fila(1, "1", { nombre: "Activo", usos: 0 }),
      fila(2, "101", { nombre: "Caja", idPadre: 1, usos: 12 }),
      fila(3, "104", { nombre: "Bancos", idPadre: 1, activo: false }),
    ]);

    const respuesta = await GET();
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.data).toEqual([
      { id: 1, codigo: "1", nombre: "Activo", tipo: "Activo", idPadre: null, activo: true, usos: 0 },
      { id: 2, codigo: "101", nombre: "Caja", tipo: "Activo", idPadre: 1, activo: true, usos: 12 },
      { id: 3, codigo: "104", nombre: "Bancos", tipo: "Activo", idPadre: 1, activo: false, usos: 0 },
    ]);

    // El orden por código es el que permite pintar el árbol en el front
    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: { codigo: "asc" },
      select: expect.anything(),
    });
  });

  it("incluye también las cuentas inactivas para poder reactivarlas", async () => {
    findManyMock.mockResolvedValue([fila(9, "999", { activo: false, usos: 3 })]);

    const respuesta = await GET();
    const cuerpo = await respuesta.json();

    expect(cuerpo.data[0].activo).toBe(false);
    expect(cuerpo.data[0].usos).toBe(3);
  });

  it("responde 500 si la base de datos falla", async () => {
    findManyMock.mockRejectedValue(new Error("sin conexión"));

    const respuesta = await GET();
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No se pudo obtener el plan contable." });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("POST /api/cuentas (registrar cuenta contable)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    conBusquedas();
    createMock.mockImplementation(
      async (argumento: { data: Record<string, unknown> }) => ({
        id_cuenta_contable: 40,
        _count: { detalles_asiento: 0 },
        ...argumento.data,
      })
    );
  });

  it("registra una cuenta raíz y la devuelve con su id", async () => {
    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(cuerpo).toEqual({
      id: 40,
      codigo: "10101",
      nombre: "Caja chica",
      tipo: "Activo",
      idPadre: null,
      activo: true,
      usos: 0,
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].data).toMatchObject({
      codigo: "10101",
      nombre: "Caja chica",
      tipo: "Activo",
      id_cuenta_padre: null,
      activo: true,
    });
  });

  it("registra una subcuenta bajo el padre indicado", async () => {
    conBusquedas({
      padre: { id_cuenta_contable: 1, tipo: "Activo", activo: true },
    });

    const respuesta = await POST(
      solicitud(cuerpoValido({ codigo: "101", nombre: "Caja", idPadre: 1 }))
    );

    expect(respuesta.status).toBe(201);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id_cuenta_contable: 1 },
      select: { id_cuenta_contable: true, tipo: true, activo: true },
    });
    expect(createMock.mock.calls[0][0].data.id_cuenta_padre).toBe(1);
  });

  it("permite dar de alta una cuenta inactiva si se pide", async () => {
    const respuesta = await POST(solicitud(cuerpoValido({ activo: false })));

    expect(respuesta.status).toBe(201);
    expect(createMock.mock.calls[0][0].data.activo).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Validaciones de contenido
  // -------------------------------------------------------------------------
  type CasoValidacion = {
    caso: string;
    cuerpo: unknown;
    mensaje: string;
  };

  const VALIDACIONES: CasoValidacion[] = [
    {
      caso: "falta el código",
      cuerpo: cuerpoValido({ codigo: "" }),
      mensaje: "El código de la cuenta es obligatorio.",
    },
    {
      caso: "el código tiene espacios o caracteres no permitidos",
      cuerpo: cuerpoValido({ codigo: "1 01" }),
      mensaje:
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion.",
    },
    {
      caso: "el código pasa de 10 caracteres",
      cuerpo: cuerpoValido({ codigo: "12345678901" }),
      mensaje:
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion.",
    },
    {
      caso: "falta el nombre",
      cuerpo: cuerpoValido({ nombre: "   " }),
      mensaje: "El nombre de la cuenta es obligatorio.",
    },
    {
      caso: "el nombre supera los 100 caracteres",
      cuerpo: cuerpoValido({ nombre: "n".repeat(101) }),
      mensaje: "El nombre de la cuenta no puede superar los 100 caracteres.",
    },
    {
      caso: "el tipo no pertenece al PCGE",
      cuerpo: cuerpoValido({ tipo: "Patrimonio neto" }),
      mensaje:
        "El tipo de cuenta no es válido (valores admitidos: Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo).",
    },
    {
      caso: "el id del padre no es un entero",
      cuerpo: cuerpoValido({ idPadre: "cualquiera" }),
      mensaje: "La cuenta padre indicada no es válida.",
    },
    {
      caso: "el estado no es booleano",
      cuerpo: cuerpoValido({ activo: "si" }),
      mensaje: "El estado de la cuenta debe ser activo o inactivo.",
    },
  ];

  it.each(VALIDACIONES)("rechaza con 400 cuando $caso", async ({ cuerpo, mensaje }) => {
    const respuesta = await POST(solicitud(cuerpo));
    const cuerpoRespuesta = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpoRespuesta.error).toBe(mensaje);
    expect(cuerpoRespuesta.errores).toContain(mensaje);

    // Nada llega a la base
    expect(createMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si el cuerpo no es un JSON válido", async () => {
    const respuesta = await POST(solicitud("esto no es json"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(createMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si el cuerpo es un arreglo", async () => {
    const respuesta = await POST(solicitud([]));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el código ya está en uso por otra cuenta", async () => {
    conBusquedas({ codigoExistente: { id_cuenta_contable: 7 } });

    const respuesta = await POST(solicitud(cuerpoValido({ codigo: "101" })));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(409);
    expect(cuerpo).toEqual({ error: "Ya existe una cuenta contable con el código 101." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el índice único detecta el duplicado al crear", async () => {
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codigo", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );

    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(409);
    expect(cuerpo.error).toContain("código");
  });

  it("rechaza la subcuenta si el padre no existe", async () => {
    conBusquedas({ padre: null });

    const respuesta = await POST(solicitud(cuerpoValido({ idPadre: 999 })));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain("La cuenta padre indicada no existe.");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rechaza la subcuenta si el padre está inactivo", async () => {
    conBusquedas({
      padre: { id_cuenta_contable: 1, tipo: "Activo", activo: false },
    });

    const respuesta = await POST(solicitud(cuerpoValido({ idPadre: 1 })));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain(
      "La cuenta padre está inactiva: actívala antes de crear subcuentas."
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rechaza la subcuenta si su tipo no coincide con el del padre", async () => {
    conBusquedas({
      padre: { id_cuenta_contable: 1, tipo: "Pasivo", activo: true },
    });

    const respuesta = await POST(
      solicitud(cuerpoValido({ idPadre: 1, tipo: "Activo" }))
    );
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain("La subcuenta debe tener el mismo tipo que su cuenta padre (Pasivo).");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 500 si la base falla al crear la cuenta", async () => {
    createMock.mockRejectedValue(new Error("sin conexión"));

    const respuesta = await POST(solicitud(cuerpoValido()));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No se pudo registrar la cuenta contable." });
    expect(console.error).toHaveBeenCalled();
  });
});
