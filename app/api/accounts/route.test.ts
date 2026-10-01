import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

const { findManyMock, findUniqueMock, createMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingAccount: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      create: createMock,
    },
  },
}));

import { GET, POST } from "./route";

/** Constructs minimum request needed by the handler. */
function createRequest(body: unknown): NextRequest {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text,
  }) as unknown as NextRequest;
}

/** Valid full body to create an account. */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    codigo: "10101",
    nombre: "Caja chica",
    tipo: "Activo",
    ...overrides,
  };
}

/** Row returned by shared select in routes. */
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

/** Configures findUnique mock for code check and parent lookup. */
function configureLookups({
  existingCode = null,
  parent = null,
}: {
  existingCode?: { id: number } | null;
  parent?: { id: number; type: string; active: boolean } | null;
} = {}) {
  findUniqueMock.mockImplementation(
    async (argument: { where: Record<string, unknown> }) =>
      "code" in argument.where ? existingCode : parent
  );
}

describe("GET /api/accounts (listar el plan contable)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("devuelve todas las cuentas con su jerarquía y su uso", async () => {
    findManyMock.mockResolvedValue([
      createAccountRow(1, "1", { name: "Activo", usages: 0 }),
      createAccountRow(2, "101", { name: "Caja", parentId: 1, usages: 12 }),
      createAccountRow(3, "104", { name: "Bancos", parentId: 1, active: false }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      { id: 1, codigo: "1", nombre: "Activo", tipo: "Activo", idPadre: null, activo: true, usos: 0 },
      { id: 2, codigo: "101", nombre: "Caja", tipo: "Activo", idPadre: 1, activo: true, usos: 12 },
      { id: 3, codigo: "104", nombre: "Bancos", tipo: "Activo", idPadre: 1, activo: false, usos: 0 },
    ]);

    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: { code: "asc" },
      select: expect.anything(),
    });
  });

  it("incluye también las cuentas inactivas para poder reactivarlas", async () => {
    findManyMock.mockResolvedValue([createAccountRow(9, "999", { active: false, usages: 3 })]);

    const response = await GET();
    const body = await response.json();

    expect(body.data[0].activo).toBe(false);
    expect(body.data[0].usos).toBe(3);
  });

  it("responde 500 si la base de datos falla", async () => {
    findManyMock.mockRejectedValue(new Error("sin conexión"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo obtener el plan contable." });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("POST /api/accounts (registrar cuenta contable)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureLookups();
    createMock.mockImplementation(
      async (argument: { data: Record<string, unknown> }) => ({
        id: 40,
        _count: { entryDetails: 0 },
        ...argument.data,
      })
    );
  });

  it("registra una cuenta raíz y la devuelve con su id", async () => {
    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
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
      code: "10101",
      name: "Caja chica",
      type: "Activo",
      parentId: null,
      active: true,
    });
  });

  it("registra una subcuenta bajo el padre indicado", async () => {
    configureLookups({
      parent: { id: 1, type: "Activo", active: true },
    });

    const response = await POST(
      createRequest(validBody({ codigo: "101", nombre: "Caja", idPadre: 1 }))
    );

    expect(response.status).toBe(201);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, type: true, active: true },
    });
    expect(createMock.mock.calls[0][0].data.parentId).toBe(1);
  });

  it("permite dar de alta una cuenta inactiva si se pide", async () => {
    const response = await POST(createRequest(validBody({ activo: false })));

    expect(response.status).toBe(201);
    expect(createMock.mock.calls[0][0].data.active).toBe(false);
  });

  type ValidationCase = {
    caseDescription: string;
    body: unknown;
    message: string;
  };

  const VALIDATIONS: ValidationCase[] = [
    {
      caseDescription: "falta el código",
      body: validBody({ codigo: "" }),
      message: "El código de la cuenta es obligatorio.",
    },
    {
      caseDescription: "el código tiene espacios o caracteres no permitidos",
      body: validBody({ codigo: "1 01" }),
      message:
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion.",
    },
    {
      caseDescription: "el código pasa de 10 caracteres",
      body: validBody({ codigo: "12345678901" }),
      message:
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion.",
    },
    {
      caseDescription: "falta el nombre",
      body: validBody({ nombre: "   " }),
      message: "El nombre de la cuenta es obligatorio.",
    },
    {
      caseDescription: "el nombre supera los 100 caracteres",
      body: validBody({ nombre: "n".repeat(101) }),
      message: "El nombre de la cuenta no puede superar los 100 caracteres.",
    },
    {
      caseDescription: "el tipo no pertenece al PCGE",
      body: validBody({ tipo: "Patrimonio neto" }),
      message:
        "El tipo de cuenta no es válido (valores admitidos: Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo).",
    },
    {
      caseDescription: "el id del padre no es un entero",
      body: validBody({ idPadre: "cualquiera" }),
      message: "La cuenta padre indicada no es válida.",
    },
    {
      caseDescription: "el estado no es booleano",
      body: validBody({ activo: "si" }),
      message: "El estado de la cuenta debe ser activo o inactivo.",
    },
  ];

  it.each(VALIDATIONS)("rechaza con 400 cuando $caseDescription", async ({ body, message }) => {
    const response = await POST(createRequest(body));
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.error).toBe(message);
    expect(responseBody.errores).toContain(message);

    expect(createMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si el cuerpo no es un JSON válido", async () => {
    const response = await POST(createRequest("esto no es json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(createMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si el cuerpo es un arreglo", async () => {
    const response = await POST(createRequest([]));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el código ya está en uso por otra cuenta", async () => {
    configureLookups({ existingCode: { id: 7 } });

    const response = await POST(createRequest(validBody({ codigo: "101" })));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Ya existe una cuenta contable con el código 101." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el índice único detecta el duplicado al crear", async () => {
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codigo", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );

    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("código");
  });

  it("rechaza la subcuenta si el padre no existe", async () => {
    configureLookups({ parent: null });

    const response = await POST(createRequest(validBody({ idPadre: 999 })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain("La cuenta padre indicada no existe.");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rechaza la subcuenta si el padre está inactivo", async () => {
    configureLookups({
      parent: { id: 1, type: "Activo", active: false },
    });

    const response = await POST(createRequest(validBody({ idPadre: 1 })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain(
      "La cuenta padre está inactiva: actívala antes de crear subcuentas."
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rechaza la subcuenta si su tipo no coincide con el del padre", async () => {
    configureLookups({
      parent: { id: 1, type: "Pasivo", active: true },
    });

    const response = await POST(
      createRequest(validBody({ idPadre: 1, tipo: "Activo" }))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores).toContain("La subcuenta debe tener el mismo tipo que su cuenta padre (Pasivo).");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 500 si la base falla al crear la cuenta", async () => {
    createMock.mockRejectedValue(new Error("sin conexión"));

    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "No se pudo registrar la cuenta contable." });
    expect(console.error).toHaveBeenCalled();
  });
});
