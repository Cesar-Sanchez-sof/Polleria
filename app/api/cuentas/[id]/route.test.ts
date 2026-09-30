import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

const { accountMock, $transactionMock } = vi.hoisted(() => {
  const accountMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  return { accountMock, $transactionMock: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { accountingAccount: accountMock, $transaction: $transactionMock },
}));

import { GET, PATCH } from "./route";

const ACCOUNT_ID = 1;

/** Constructs minimal NextRequest with JSON body. */
function createRequest(body: unknown): NextRequest {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/cuentas/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: text,
  }) as unknown as NextRequest;
}

/** Row returned by select in account routes. */
function createAccountRow(
  id: number,
  code: string,
  options: {
    name?: string;
    type?: string;
    parentId?: number | null;
    active?: boolean;
    usages?: number;
  } = {}
) {
  return {
    id,
    code,
    name: options.name ?? `Cuenta ${code}`,
    type: options.type ?? "Activo",
    parentId: options.parentId ?? null,
    active: options.active ?? true,
    _count: { entryDetails: options.usages ?? 0 },
  };
}

/** Minimal hierarchy node for tree checks. */
function createNode(id: number, parentId: number | null) {
  return { id, parentId };
}

/** Prepares mock behavior for account tests. */
function setupScenario({
  account = createAccountRow(ACCOUNT_ID, "101"),
  parent = null,
  duplicateCode = null,
  nodes = [],
  activeChild = null,
}: {
  account?: ReturnType<typeof createAccountRow> | null;
  parent?: { id: number; type: string; active: boolean } | null;
  duplicateCode?: { id: number } | null;
  nodes?: ReturnType<typeof createNode>[];
  activeChild?: { id: number } | null;
} = {}) {
  accountMock.findUnique.mockReset();
  accountMock.findUnique
    .mockResolvedValueOnce(account)
    .mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        "code" in args.where ? duplicateCode : parent
    );
  accountMock.findMany.mockResolvedValue(nodes);
  accountMock.findFirst.mockResolvedValue(activeChild);
  accountMock.update.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      ...account,
      ...args.data,
      _count: { entryDetails: account?._count?.entryDetails ?? 0 },
    })
  );
  accountMock.updateMany.mockResolvedValue({ count: 0 });
  $transactionMock.mockImplementation(
    async (fn: (tx: { accountingAccount: typeof accountMock }) => Promise<unknown>) =>
      fn({ accountingAccount: accountMock })
  );
}

describe("GET /api/cuentas/[id] (detalle de una cuenta)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve la cuenta solicitada", async () => {
    setupScenario({ account: createAccountRow(7, "104", { name: "Bancos", usages: 4 }) });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "7" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
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
    setupScenario({ account: null });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "9999" }),
    });

    expect(response.status).toBe(404);
  });

  it("responde 400 si el identificador no es numérico", async () => {
    setupScenario();

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "cualquiera" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Identificador de cuenta inválido." });
    expect(accountMock.findUnique).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/cuentas/[id] (editar cuenta contable)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupScenario();
  });

  it("actualiza sólo los campos enviados", async () => {
    const response = await PATCH(createRequest({ nombre: "Caja chica general" }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: ACCOUNT_ID, nombre: "Caja chica general" });
    expect(body.codigo).toBe("101");

    expect(accountMock.update).toHaveBeenCalledTimes(1);
    expect(accountMock.update.mock.calls[0][0]).toMatchObject({
      where: { id: ACCOUNT_ID },
      data: { name: "Caja chica general" },
    });
    expect(accountMock.updateMany).not.toHaveBeenCalled();
  });

  it("renombra el código cuando sigue siendo único", async () => {
    setupScenario();

    const response = await PATCH(createRequest({ codigo: "10101" }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });

    expect(response.status).toBe(200);
    expect(accountMock.findUnique).toHaveBeenCalledWith({
      where: { code: "10101" },
      select: { id: true },
    });
    expect(accountMock.update.mock.calls[0][0].data).toEqual({ code: "10101" });
  });

  it("propaga el nuevo tipo a todas las subcuentas", async () => {
    setupScenario({
      account: createAccountRow(1, "4", { type: "Pasivo" }),
      nodes: [createNode(1, null), createNode(2, 1), createNode(3, 1), createNode(4, 2)],
    });

    const response = await PATCH(createRequest({ tipo: "Activo" }), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(200);
    expect(accountMock.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 3, 4] } },
      data: { type: "Activo" },
    });
    expect(accountMock.update.mock.calls[0][0].data).toEqual({ type: "Activo" });
  });

  it("cambia la cuenta padre dentro de la misma transacción", async () => {
    setupScenario({
      account: createAccountRow(3, "101", { parentId: 1 }),
      parent: { id: 5, type: "Activo", active: true },
      nodes: [createNode(1, null), createNode(3, 1), createNode(5, null)],
    });

    const response = await PATCH(createRequest({ idPadre: 5 }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(response.status).toBe(200);
    expect(accountMock.update.mock.calls[0][0].data).toEqual({ parentId: 5 });
    expect($transactionMock).toHaveBeenCalledTimes(1);
  });

  it("permite convertir una cuenta en raíz quitando el padre", async () => {
    setupScenario({ account: createAccountRow(3, "101", { parentId: 1 }) });

    const response = await PATCH(createRequest({ idPadre: null }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(response.status).toBe(200);
    expect(accountMock.update.mock.calls[0][0].data).toEqual({ parentId: null });
    expect(accountMock.findUnique).toHaveBeenCalledTimes(1);
  });

  it("activa y desactiva cuentas", async () => {
    setupScenario({ account: createAccountRow(3, "101", { active: false, parentId: null }) });

    const response = await PATCH(createRequest({ activo: true }), {
      params: Promise.resolve({ id: "3" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activo).toBe(true);
    expect(accountMock.update.mock.calls[0][0].data).toEqual({ active: true });
  });

  it("devuelve 409 si el código ya pertenece a otra cuenta", async () => {
    setupScenario({ duplicateCode: { id: 88 } });

    const response = await PATCH(createRequest({ codigo: "104" }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Ya existe una cuenta contable con el código 104." });
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el índice único detecta el duplicado al guardar", async () => {
    setupScenario();
    accountMock.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codigo", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );

    const response = await PATCH(createRequest({ codigo: "104" }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("104");
  });

  it("rechaza con 400 los datos inválidos sin tocar la base", async () => {
    setupScenario();

    const response = await PATCH(createRequest({ nombre: "   " }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain("El nombre de la cuenta es obligatorio.");
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un cuerpo que no sea JSON", async () => {
    setupScenario();

    const response = await PATCH(createRequest("no soy json"), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("no permite que una cuenta sea su propia padre", async () => {
    setupScenario();

    const response = await PATCH(createRequest({ idPadre: ACCOUNT_ID }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain("Una cuenta no puede ser su propia cuenta padre.");
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("no permite colgar una cuenta de una de sus propias subcuentas", async () => {
    setupScenario({
      parent: { id: 2, type: "Activo", active: true },
      nodes: [createNode(1, null), createNode(2, 1), createNode(3, 2)],
    });

    const response = await PATCH(createRequest({ idPadre: 2 }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain(
      "La cuenta padre no puede ser una subcuenta de la misma cuenta."
    );
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("rechaza mover la cuenta a un padre inexistente", async () => {
    setupScenario({ parent: null });

    const response = await PATCH(createRequest({ idPadre: 404 }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain("La cuenta padre indicada no existe.");
  });

  it("rechaza mover la cuenta a un padre inactivo", async () => {
    setupScenario({
      parent: { id: 2, type: "Activo", active: false },
      nodes: [createNode(1, null), createNode(2, null)],
    });

    const response = await PATCH(createRequest({ idPadre: 2 }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain(
      "La cuenta padre está inactiva: actívala antes de mover la cuenta."
    );
  });

  it("rechaza mover la cuenta a un padre de otro tipo", async () => {
    setupScenario({
      parent: { id: 2, type: "Pasivo", active: true },
      nodes: [createNode(1, null), createNode(2, null)],
    });

    const response = await PATCH(createRequest({ idPadre: 2 }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain(
      "La subcuenta debe tener el mismo tipo que su cuenta padre (Pasivo)."
    );
  });

  it("no deja desactivar una cuenta con subcuentas activas", async () => {
    setupScenario({ activeChild: { id: 6 } });

    const response = await PATCH(createRequest({ activo: false }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain(
      "No se puede desactivar una cuenta con subcuentas activas: desactívalas primero."
    );
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("no deja activar una cuenta cuyo padre esté inactiva", async () => {
    setupScenario({
      account: createAccountRow(6, "101", { parentId: 3, active: false }),
      parent: { id: 3, type: "Activo", active: false },
    });

    const response = await PATCH(createRequest({ activo: true }), {
      params: Promise.resolve({ id: "6" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain(
      "No se puede activar una cuenta cuya cuenta padre está inactiva."
    );
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("responde 404 si la cuenta ya no existe", async () => {
    setupScenario({ account: null });

    const response = await PATCH(createRequest({ nombre: "Nueva" }), {
      params: Promise.resolve({ id: "9999" }),
    });

    expect(response.status).toBe(404);
    expect(accountMock.update).not.toHaveBeenCalled();
  });

  it("responde 400 si el identificador no es numérico", async () => {
    setupScenario();

    const response = await PATCH(createRequest({ nombre: "Nueva" }), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
    expect(accountMock.findUnique).not.toHaveBeenCalled();
  });

  it("responde 500 si la base falla al actualizar", async () => {
    setupScenario();
    accountMock.update.mockRejectedValue(new Error("sin conexión"));

    const response = await PATCH(createRequest({ nombre: "Nueva" }), {
      params: Promise.resolve({ id: String(ACCOUNT_ID) }),
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo actualizar la cuenta contable." });
    expect(console.error).toHaveBeenCalled();
  });
});
