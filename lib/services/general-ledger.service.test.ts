import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGeneralLedgerQuery,
  ApiError,
  getGeneralLedger,
  type GeneralLedger,
} from "./general-ledger.service";

const LEDGER_DATA: GeneralLedger = {
  account: { code: "101", name: "Caja", type: "Activo" },
  previousBalance: 0,
  finalBalance: 118,
  totals: { debit: 118, credit: 0, movements: 1 },
  movements: [
    {
      id: 71,
      entryId: 7,
      number: "MISC/2025/06/0007",
      date: "2025-06-18",
      entryDescription: "Venta mostrador",
      description: "Cobro en efectivo",
      accountCode: "101",
      accountName: "Caja",
      module: "Facturas de cliente",
      reference: "Factura 001-461",
      status: "Registrado",
      debit: 118,
      credit: 0,
      balance: 118,
      balanceType: "deudor",
    },
  ],
};

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error("La petición no lanzó el error esperado.");
}

const fetchMock = vi.fn();

describe("buildGeneralLedgerQuery (libro mayor)", () => {
  it("siempre envía la cuenta consultada", () => {
    expect(buildGeneralLedgerQuery({ code: "101" })).toBe("codigo=101");
  });

  it("serializa el periodo completo", () => {
    const params = new URLSearchParams(
      buildGeneralLedgerQuery({ code: "101", from: "2025-05-01", to: "2025-06-30" })
    );

    expect(params.get("codigo")).toBe("101");
    expect(params.get("desde")).toBe("2025-05-01");
    expect(params.get("hasta")).toBe("2025-06-30");
  });

  it("omite los extremos de fecha vacíos", () => {
    const params = new URLSearchParams(
      buildGeneralLedgerQuery({ code: "201", to: "2025-06-30" })
    );

    expect(params.get("desde")).toBeNull();
    expect(params.get("hasta")).toBe("2025-06-30");
  });
});

describe("getGeneralLedger", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta /api/general-ledger con la cuenta y el periodo, sin caché", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(LEDGER_DATA));

    const result = await getGeneralLedger({
      code: "101",
      from: "2025-05-01",
    });

    expect(result).toEqual(LEDGER_DATA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/general-ledger?codigo=101&desde=2025-05-01",
      { cache: "no-store" }
    );
  });

  it("consulta /api/general-ledger sólo con la cuenta cuando no hay periodo", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(LEDGER_DATA));

    await getGeneralLedger({ code: "101" });

    expect(fetchMock).toHaveBeenCalledWith("/api/general-ledger?codigo=101", { cache: "no-store" });
  });

  it("propaga el error del servidor como ErrorApi con sus validaciones", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({ error: "La fecha inicial no puede ser posterior a la fecha final." }, 400)
    );

    const error = await catchApiError(
      getGeneralLedger({ code: "101", from: "2025-06-30", to: "2025-05-01" })
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("La fecha inicial no puede ser posterior a la fecha final.");
  });
});
