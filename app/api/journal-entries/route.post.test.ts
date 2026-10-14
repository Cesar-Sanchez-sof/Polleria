import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { parseUtcDate } from "@/lib/dates";

const {
  accountFindManyMock,
  accountingPeriodFindFirstMock,
  createMock,
  generateCodeMock,
} = vi.hoisted(() => ({
  accountFindManyMock: vi.fn(),
  accountingPeriodFindFirstMock: vi.fn(),
  createMock: vi.fn(),
  generateCodeMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingAccount: { findMany: accountFindManyMock },
    accountingPeriod: { findFirst: accountingPeriodFindFirstMock },
    journalEntry: { create: createMock },
  },
}));

vi.mock("@/lib/journal-entry-code", () => ({
  generateJournalEntryCode: generateCodeMock,
}));

import { POST } from "./route";

const CASH_ACCOUNT_ID = 7;
const SALES_ACCOUNT_ID = 21;
const VAT_ACCOUNT_ID = 173;

function createRequest(body: unknown): NextRequest {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/journal-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text,
  }) as unknown as NextRequest;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-09-27",
    daily: "Facturas de cliente",
    description: "Venta mostrador F001-000461",
    responsible: "Leandro Mauricci",
    observation: "Registrado desde el diálogo",
    lines: [
      { accountId: CASH_ACCOUNT_ID, description: "Cobro en efectivo", debit: 118, credit: 0 },
      { accountId: SALES_ACCOUNT_ID, description: "Venta de mercadería", debit: 0, credit: 100 },
      { accountId: VAT_ACCOUNT_ID, description: "IGV débito fiscal", debit: 0, credit: 18 },
    ],
    ...overrides,
  };
}

function createDummyLine(index: number) {
  return index % 2 === 0
    ? { accountId: CASH_ACCOUNT_ID, debit: 1, credit: 0 }
    : { accountId: SALES_ACCOUNT_ID, debit: 0, credit: 1 };
}

describe("POST /api/journal-entries (registrar asiento manual)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    generateCodeMock.mockResolvedValue("MISC/2026/09/0001");
    accountFindManyMock.mockResolvedValue([
      { id: CASH_ACCOUNT_ID },
      { id: SALES_ACCOUNT_ID },
      { id: VAT_ACCOUNT_ID },
    ]);

    accountingPeriodFindFirstMock.mockResolvedValue({
      id: 1,
      status: "OPEN",
    });

    createMock.mockImplementation(async (arg: { data: Record<string, unknown> }) => ({
      id: 501,
      ...arg.data,
    }));
  });

  it("registra el asiento cuadrado y devuelve su resumen", async () => {
    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: 501,
      number: "MISC/2026/09/0001",
      date: "2026-09-27",
      daily: "Facturas de cliente",
      concept: "Venta mostrador F001-000461",
      responsible: "Leandro Mauricci",
      status: "Registrado",
      total: 118,
    });

    expect(generateCodeMock).toHaveBeenCalledTimes(1);
    expect(generateCodeMock).toHaveBeenCalledWith(parseUtcDate("2026-09-27"));

    expect(createMock).toHaveBeenCalledTimes(1);
    const { data } = createMock.mock.calls[0][0];
    expect(data).toMatchObject({
      code: "MISC/2026/09/0001",
      entryDate: parseUtcDate("2026-09-27"),
      description: "Venta mostrador F001-000461",
      book: "Facturas de cliente",
      responsible: "Leandro Mauricci",
      observation: "Registrado desde el diálogo",
      status: true,
    });
    expect(data.entryDetails.create).toEqual([
      { accountId: CASH_ACCOUNT_ID, description: "Cobro en efectivo", debit: 118, credit: 0 },
      { accountId: SALES_ACCOUNT_ID, description: "Venta de mercadería", debit: 0, credit: 100 },
      { accountId: VAT_ACCOUNT_ID, description: "IGV débito fiscal", debit: 0, credit: 18 },
    ]);
  });

  it("consulta del plan sólo las cuentas distintas del asiento", async () => {
    await POST(
      createRequest(
        validBody({
          lines: [
            { accountId: CASH_ACCOUNT_ID, debit: 118, credit: 0 },
            { accountId: CASH_ACCOUNT_ID, debit: 0, credit: 118 },
          ],
        })
      )
    );

    expect(accountFindManyMock).toHaveBeenCalledWith({
      where: { id: { in: [CASH_ACCOUNT_ID] } },
      select: { id: true },
    });
  });

  it("aplica los valores por defecto del diario, estado y textos opcionales", async () => {
    const response = await POST(
      createRequest({
        date: "2026-09-27",
        description: "Ajuste por caja chica",
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 50, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: 0, credit: 50 },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      daily: "Operaciones varias",
      status: "Registrado",
      responsible: null,
      total: 50,
    });

    const { data } = createMock.mock.calls[0][0];
    expect(data).toMatchObject({ book: "Operaciones varias", status: true });
    expect(data.responsible).toBeNull();
    expect(data.observation).toBeNull();
  });

  it("registra un asiento enviado como anulado", async () => {
    const response = await POST(createRequest(validBody({ status: false })));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("Anulado");
    expect(createMock.mock.calls[0][0].data.status).toBe(false);
  });

  it("acepta importes en texto, los redondea a 2 decimales y omite la descripción vacía", async () => {
    const response = await POST(
      createRequest(
        validBody({
          lines: [
            { accountId: CASH_ACCOUNT_ID, description: "", debit: "10.567", credit: "" },
            { accountId: SALES_ACCOUNT_ID, debit: 0, credit: "10.567" },
          ],
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.total).toBe(10.57);
    expect(createMock.mock.calls[0][0].data.entryDetails.create).toEqual([
      { accountId: CASH_ACCOUNT_ID, description: null, debit: 10.57, credit: 0 },
      { accountId: SALES_ACCOUNT_ID, description: null, debit: 0, credit: 10.57 },
    ]);
  });

  it("responde 400 si el cuerpo no es un JSON válido", async () => {
    const response = await POST(createRequest("esto no es json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "El cuerpo de la petición no es un JSON válido." });
    expect(createMock).not.toHaveBeenCalled();
    expect(generateCodeMock).not.toHaveBeenCalled();
  });

  it("responde 400 si el cuerpo es un arreglo", async () => {
    const response = await POST(createRequest([]));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("El cuerpo de la petición no es un JSON válido.");
    expect(createMock).not.toHaveBeenCalled();
  });

  type ValidationCase = {
    caseDescription: string;
    overrides: Record<string, unknown>;
    message: string;
  };

  const VALIDATIONS: ValidationCase[] = [
    {
      caseDescription: "la fecha viene vacía",
      overrides: { date: "" },
      message: "La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.",
    },
    {
      caseDescription: "la fecha no tiene formato AAAA-MM-DD",
      overrides: { date: "27/09/2026" },
      message: "La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.",
    },
    {
      caseDescription: "la glosa está vacía",
      overrides: { description: "   " },
      message: "El concepto (glosa) del asiento es obligatorio.",
    },
    {
      caseDescription: "la glosa supera los 200 caracteres",
      overrides: { description: "g".repeat(201) },
      message: "El concepto no puede superar los 200 caracteres.",
    },
    {
      caseDescription: "el diario supera los 60 caracteres",
      overrides: { daily: "d".repeat(61) },
      message: "El diario no puede superar los 60 caracteres.",
    },
    {
      caseDescription: "el responsable supera los 100 caracteres",
      overrides: { responsible: "r".repeat(101) },
      message: "El responsable no puede superar los 100 caracteres.",
    },
    {
      caseDescription: "la observación supera los 200 caracteres",
      overrides: { observation: "o".repeat(201) },
      message: "La observación no puede superar los 200 caracteres.",
    },
    {
      caseDescription: "el asiento trae una sola línea",
      overrides: { lines: [{ accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 }] },
      message: "El asiento debe registrar al menos dos líneas (debe y haber).",
    },
    {
      caseDescription: "el asiento trae más de 100 líneas",
      overrides: { lines: Array.from({ length: 101 }, (_, i) => createDummyLine(i)) },
      message: "El asiento no puede superar las 100 líneas.",
    },
    {
      caseDescription: "una línea no trae cuenta contable",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { debit: 0, credit: 100 },
        ],
      },
      message: "Línea 2: falta la cuenta contable.",
    },
    {
      caseDescription: "el id de la cuenta no es un entero",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { accountId: "cualquiera", debit: 0, credit: 100 },
        ],
      },
      message: "Línea 2: falta la cuenta contable.",
    },
    {
      caseDescription: "la línea no es un objeto",
      overrides: {
        lines: ["esto no es una línea", { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 }],
      },
      message: "Línea 1: el formato de la línea no es válido.",
    },
    {
      caseDescription: "la descripción de la línea supera los 200 caracteres",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, description: "d".repeat(201), debit: 100, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: 0, credit: 100 },
        ],
      },
      message: "Línea 1: la descripción no puede superar los 200 caracteres.",
    },
    {
      caseDescription: "los importes no son números",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: "mil", credit: 0 },
        ],
      },
      message: "Línea 2: los importes deben ser números válidos.",
    },
    {
      caseDescription: "los importes son negativos",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: -50, credit: 0 },
        ],
      },
      message: "Línea 2: los importes no pueden ser negativos.",
    },
    {
      caseDescription: "la línea trae importe en debe y en haber",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: 50, credit: 50 },
        ],
      },
      message: "Línea 2: no puede tener importe en debe y en haber al mismo tiempo.",
    },
    {
      caseDescription: "la línea no trae importes",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: 0, credit: 0 },
        ],
      },
      message: "Línea 2: debe tener un importe en debe o en haber.",
    },
    {
      caseDescription: "el asiento no cuadra",
      overrides: {
        lines: [
          { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
          { accountId: SALES_ACCOUNT_ID, debit: 0, credit: 90 },
        ],
      },
      message: "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00).",
    },
  ];

  it.each(VALIDATIONS)("rechaza con 400 cuando $caseDescription", async ({ overrides, message }) => {
    const response = await POST(createRequest(validBody(overrides)));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(message);
    expect(body.errors).toContain(message);

    expect(generateCodeMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 400 si alguna línea apunta a una cuenta inexistente", async () => {
    accountFindManyMock.mockResolvedValue([{ id: CASH_ACCOUNT_ID }]);

    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Una o más cuentas contables del asiento no existen en el plan contable.",
    });
    expect(accountFindManyMock).toHaveBeenCalledWith({
      where: { id: { in: [CASH_ACCOUNT_ID, SALES_ACCOUNT_ID, VAT_ACCOUNT_ID] } },
      select: { id: true },
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(generateCodeMock).not.toHaveBeenCalled();
  });

  function duplicateCodeError(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codigo", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
  }

  it("reintenta con un número nuevo cuando el código está ocupado", async () => {
    generateCodeMock
      .mockResolvedValueOnce("MISC/2026/09/0001")
      .mockResolvedValueOnce("MISC/2026/09/0002");
    createMock
      .mockRejectedValueOnce(duplicateCodeError())
      .mockResolvedValueOnce({
        id: 502,
        code: "MISC/2026/09/0002",
        book: "Facturas de cliente",
        description: "Venta mostrador F001-000461",
        responsible: "Leandro Mauricci",
        status: true,
      });

    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.number).toBe("MISC/2026/09/0002");

    expect(generateCodeMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1][0].data.code).toBe("MISC/2026/09/0002");
  });

  it("responde 500 si los tres intentos chocan con el mismo número", async () => {
    createMock.mockRejectedValue(duplicateCodeError());

    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "No se pudo asignar un número de asiento, intente nuevamente.",
    });
    expect(createMock).toHaveBeenCalledTimes(3);
    expect(generateCodeMock).toHaveBeenCalledTimes(3);
  });

  it("no reintenta ante un error de la base que no sea de código duplicado", async () => {
    createMock.mockRejectedValue(new Error("sin conexión"));

    const response = await POST(createRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "No se pudo asignar un número de asiento, intente nuevamente.",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});
