import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

// Los mocks se declaran con vi.hoisted porque vi.mock se evalúa antes que el
// resto del archivo: así se pueden usar directamente en las aserciones.
const { cuentaMock, $transactionMock } = vi.hoisted(() => {
  const cuentaMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  return { cuentaMock, $transactionMock: vi.fn() };
});

// Prisma se sustituye por mocks: estos tests no tocan la base de datos.
vi.mock("@/lib/prisma", () => ({
  prisma: { cuenta_contable: cuentaMock, $transaction: $transactionMock },
}));

import { GET, PATCH } from "./route";

/** Identificador de la cuenta que se está editando en la mayoría de tests. */
const ID = 1;

/** Construye la mínima petición que necesita el handler (sólo lee `json()`). */
function solicitud(cuerpo: unknown): NextRequest {
  const texto = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return new Request("http://localhost/api/cuentas/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: texto,
  }) as unknown as NextRequest;
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

/** Fila mínima para el listado de jerarquía (id + padre). */
function nodo(id: number, idPadre: number | null) {
  return { id_cuenta_contable: id, id_cuenta_padre: idPadre };
}

/**
 * Prepara el escenario: la primera consulta devuelve la cuenta en edición y
 * las siguientes resuelven código repetido o cuenta padre según el `where`.
 */
function preparar({
  cuenta = fila(ID, "101"),
  padre = null,
  codigoRepetido = null,
  nodos = [],
  hijaActiva = null,
}: {
  cuenta?: ReturnType<typeof fila>;
  padre?: { id_cuenta_contable: number; tipo: string; activo: boolean } | null;
  codigoRepetido?: { id_cuenta_contable: number } | null;
  nodos?: ReturnType<typeof nodo>[];
  hijaActiva?: { id_cuenta_contable: number } | null;
} = {}) {
  // Se limpian los valores "once" pendientes: preparar puede llamarse otra vez
  // desde el test para cambiar el escenario sin heredar el del beforeEach.
  cuentaMock.findUnique.mockReset();
  cuentaMock.findUnique
    .mockResolvedValueOnce(cuenta)
    .mockImplementation(
      async (argumento: { where: Record<string, unknown> }) =>
        "codigo" in argumento.where ? codigoRepetido : padre
    );
  cuentaMock.findMany.mockResolvedValue(nodos);
  cuentaMock.findFirst.mockResolvedValue(hijaActiva);
  cuentaMock.update.mockImplementation(
    async (argumento: { data: Record<string, unknown> }) => ({
      ...cuenta,
      ...argumento.data,
      _count: { detalles_asiento: cuenta._count.detalles_asiento },
    })
  );
  cuentaMock.updateMany.mockResolvedValue({ count: 0 });
  // La transacción interactiva recibe el propio mock como cliente.
  $transactionMock.mockImplementation(
    async (funcion: (tx: { cuenta_contable: typeof cuentaMock }) => Promise<unknown>) =>
      funcion({ cuenta_contable: cuentaMock })
  );
}

describe("GET /api/cuentas/[id] (detalle de una cuenta)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve la cuenta solicitada", async () => {
    preparar({ cuenta: fila(7, "104", { nombre: "Bancos", usos: 4 }) });

    const respuesta = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "7" }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({
      id: 7,
      codigo: "104",
      nombre: "Bancos",
      tipo: "Activo",
      idPadre: null,
      activo: true,
      usos: 4,
    });
  });

  it("responde 404 si la cuenta no existe", async () => {
    preparar({ cuenta: null as unknown as ReturnType<typeof fila> });

    const respuesta = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "9999" }),
    });

    expect(respuesta.status).toBe(404);
  });

  it("responde 400 si el identificador no es numérico", async () => {
    preparar();

    const respuesta = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "cualquiera" }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "Identificador de cuenta inválido." });
    expect(cuentaMock.findUnique).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/cuentas/[id] (editar cuenta contable)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    preparar();
  });

  it("actualiza sólo los campos enviados", async () => {
    const respuesta = await PATCH(solicitud({ nombre: "Caja chica general" }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject({ id: ID, nombre: "Caja chica general" });
    expect(cuerpo.codigo).toBe("101");

    expect(cuentaMock.update).toHaveBeenCalledTimes(1);
    expect(cuentaMock.update.mock.calls[0][0]).toMatchObject({
      where: { id_cuenta_contable: ID },
      data: { nombre: "Caja chica general" },
    });
    // Sin cambio de tipo no hay nada que propagar
    expect(cuentaMock.updateMany).not.toHaveBeenCalled();
  });

  it("renombra el código cuando sigue siendo único", async () => {
    preparar();

    const respuesta = await PATCH(solicitud({ codigo: "10101" }), {
      params: Promise.resolve({ id: String(ID) }),
    });

    expect(respuesta.status).toBe(200);
    expect(cuentaMock.findUnique).toHaveBeenCalledWith({
      where: { codigo: "10101" },
      select: { id_cuenta_contable: true },
    });
    expect(cuentaMock.update.mock.calls[0][0].data).toEqual({ codigo: "10101" });
  });

  it("propaga el nuevo tipo a todas las subcuentas", async () => {
    preparar({
      cuenta: fila(1, "4", { tipo: "Pasivo" }),
      nodos: [nodo(1, null), nodo(2, 1), nodo(3, 1), nodo(4, 2)],
    });

    const respuesta = await PATCH(solicitud({ tipo: "Activo" }), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(respuesta.status).toBe(200);
    // Nodos, nietos y hijas reciben el mismo tipo que la raíz
    expect(cuentaMock.updateMany).toHaveBeenCalledWith({
      where: { id_cuenta_contable: { in: [2, 3, 4] } },
      data: { tipo: "Activo" },
    });
    expect(cuentaMock.update.mock.calls[0][0].data).toEqual({ tipo: "Activo" });
  });

  it("cambia la cuenta padre dentro de la misma transacción", async () => {
    preparar({
      cuenta: fila(3, "101", { idPadre: 1 }),
      padre: { id_cuenta_contable: 5, tipo: "Activo", activo: true },
      nodos: [nodo(1, null), nodo(3, 1), nodo(5, null)],
    });

    const respuesta = await PATCH(solicitud({ idPadre: 5 }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(respuesta.status).toBe(200);
    expect(cuentaMock.update.mock.calls[0][0].data).toEqual({ id_cuenta_padre: 5 });
    expect($transactionMock).toHaveBeenCalledTimes(1);
  });

  it("permite convertir una cuenta en raíz quitando el padre", async () => {
    preparar({ cuenta: fila(3, "101", { idPadre: 1 }) });

    const respuesta = await PATCH(solicitud({ idPadre: null }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(respuesta.status).toBe(200);
    expect(cuentaMock.update.mock.calls[0][0].data).toEqual({ id_cuenta_padre: null });
    // Al no haber padre no se vuelve a consultar la jerarquía de tipos
    expect(cuentaMock.findUnique).toHaveBeenCalledTimes(1);
  });

  it("activa y desactiva cuentas", async () => {
    preparar({ cuenta: fila(3, "101", { activo: false, idPadre: null }) });

    const respuesta = await PATCH(solicitud({ activo: true }), {
      params: Promise.resolve({ id: "3" }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(cuerpo.activo).toBe(true);
    expect(cuentaMock.update.mock.calls[0][0].data).toEqual({ activo: true });
  });

  // -------------------------------------------------------------------------
  // Validaciones
  // -------------------------------------------------------------------------
  it("devuelve 409 si el código ya pertenece a otra cuenta", async () => {
    preparar({ codigoRepetido: { id_cuenta_contable: 88 } });

    const respuesta = await PATCH(solicitud({ codigo: "104" }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(409);
    expect(cuerpo).toEqual({ error: "Ya existe una cuenta contable con el código 104." });
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el índice único detecta el duplicado al guardar", async () => {
    preparar();
    cuentaMock.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codigo", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );

    const respuesta = await PATCH(solicitud({ codigo: "104" }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(409);
    expect(cuerpo.error).toContain("104");
  });

  it("rechaza con 400 los datos inválidos sin tocar la base", async () => {
    preparar();

    const respuesta = await PATCH(solicitud({ nombre: "   " }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain("El nombre de la cuenta es obligatorio.");
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un cuerpo que no sea JSON", async () => {
    preparar();

    const respuesta = await PATCH(solicitud("no soy json"), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("no permite que una cuenta sea su propia padre", async () => {
    preparar();

    const respuesta = await PATCH(solicitud({ idPadre: ID }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain("Una cuenta no puede ser su propia cuenta padre.");
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("no permite colgar una cuenta de una de sus propias subcuentas", async () => {
    preparar({
      padre: { id_cuenta_contable: 2, tipo: "Activo", activo: true },
      nodos: [nodo(1, null), nodo(2, 1), nodo(3, 2)],
    });

    const respuesta = await PATCH(solicitud({ idPadre: 2 }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain(
      "La cuenta padre no puede ser una subcuenta de la misma cuenta."
    );
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("rechaza mover la cuenta a un padre inexistente", async () => {
    preparar({ padre: null });

    const respuesta = await PATCH(solicitud({ idPadre: 404 }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain("La cuenta padre indicada no existe.");
  });

  it("rechaza mover la cuenta a un padre inactivo", async () => {
    preparar({
      padre: { id_cuenta_contable: 2, tipo: "Activo", activo: false },
      nodos: [nodo(1, null), nodo(2, null)],
    });

    const respuesta = await PATCH(solicitud({ idPadre: 2 }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain(
      "La cuenta padre está inactiva: actívala antes de mover la cuenta."
    );
  });

  it("rechaza mover la cuenta a un padre de otro tipo", async () => {
    preparar({
      padre: { id_cuenta_contable: 2, tipo: "Pasivo", activo: true },
      nodos: [nodo(1, null), nodo(2, null)],
    });

    const respuesta = await PATCH(solicitud({ idPadre: 2 }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain(
      "La subcuenta debe tener el mismo tipo que su cuenta padre (Pasivo)."
    );
  });

  it("no deja desactivar una cuenta con subcuentas activas", async () => {
    preparar({ hijaActiva: { id_cuenta_contable: 6 } });

    const respuesta = await PATCH(solicitud({ activo: false }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain(
      "No se puede desactivar una cuenta con subcuentas activas: desactívalas primero."
    );
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("no deja activar una cuenta cuyo padre esté inactiva", async () => {
    preparar({
      cuenta: fila(6, "101", { idPadre: 3, activo: false }),
      padre: { id_cuenta_contable: 3, tipo: "Activo", activo: false },
    });

    const respuesta = await PATCH(solicitud({ activo: true }), {
      params: Promise.resolve({ id: "6" }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo.errores).toContain(
      "No se puede activar una cuenta cuya cuenta padre está inactiva."
    );
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("responde 404 si la cuenta ya no existe", async () => {
    preparar({ cuenta: null as unknown as ReturnType<typeof fila> });

    const respuesta = await PATCH(solicitud({ nombre: "Nueva" }), {
      params: Promise.resolve({ id: "9999" }),
    });

    expect(respuesta.status).toBe(404);
    expect(cuentaMock.update).not.toHaveBeenCalled();
  });

  it("responde 400 si el identificador no es numérico", async () => {
    preparar();

    const respuesta = await PATCH(solicitud({ nombre: "Nueva" }), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(respuesta.status).toBe(400);
    expect(cuentaMock.findUnique).not.toHaveBeenCalled();
  });

  it("responde 500 si la base falla al actualizar", async () => {
    preparar();
    cuentaMock.update.mockRejectedValue(new Error("sin conexión"));

    const respuesta = await PATCH(solicitud({ nombre: "Nueva" }), {
      params: Promise.resolve({ id: String(ID) }),
    });
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No se pudo actualizar la cuenta contable." });
    expect(console.error).toHaveBeenCalled();
  });
});
