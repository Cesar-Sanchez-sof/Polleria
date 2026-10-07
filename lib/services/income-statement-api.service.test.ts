import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  buildIncomeStatementQuery,
  formatPeriodLabel,
  getIncomeStatement,
  type IncomeStatementResult,
} from "./income-statement-api.service";

const RESULT: IncomeStatementResult = {
  operating_income: {
    ordinary_income: 920,
    sublease_and_other_income: 0,
    total: 920,
  },
  sales_costs: { cost_of_goods_sold: 400 },
  gross_profit: { amount: 520 },
  operating_expenses: { distribution: 60, administrative: 100, total: 160 },
  operating_profit: { amount: 360 },
  other_revenues_and_expenses: { revenues: 500, expenses: 0, total: 500 },
  exchange_difference_net: { amount: 5 },
  financial_income: { amount: 20 },
  financial_expenses: { amount: 15 },
  result_before_taxes: { amount: 870 },
  income_tax_expense: { amount: 100 },
  net_profit: { amount: 770 },
  period: { start_date: "2026-01-01", end_date: "2026-01-31" },
  currency: "PEN",
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

describe("buildIncomeStatementQuery", () => {
  it("serializa el periodo completo", () => {
    const params = new URLSearchParams(
      buildIncomeStatementQuery({ desde: "2026-01-01", hasta: "2026-01-31" })
    );
    expect(params.get("desde")).toBe("2026-01-01");
    expect(params.get("hasta")).toBe("2026-01-31");
  });

  it("omite las fechas vacías", () => {
    expect(buildIncomeStatementQuery({})).toBe("");
    expect(buildIncomeStatementQuery({ hasta: "2026-01-31" })).toBe("hasta=2026-01-31");
  });
});

describe("getIncomeStatement", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta /api/income-statement con el periodo, sin caché", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(RESULT));

    const result = await getIncomeStatement({ desde: "2026-01-01", hasta: "2026-01-31" });

    expect(result).toEqual(RESULT);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/income-statement?desde=2026-01-01&hasta=2026-01-31",
      { cache: "no-store" }
    );
  });

  it("propaga el periodo inválido como ApiError con su validación", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(
        { error: "La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD." },
        400
      )
    );

    const error = await catchApiError(
      getIncomeStatement({ desde: "", hasta: "2026-01-31" })
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(
      "La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD."
    );
    expect(error.errors).toEqual([
      "La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD.",
    ]);
  });
});

describe("formatPeriodLabel", () => {
  it("etiqueta el periodo en español sin corrimiento de zona horaria", () => {
    expect(formatPeriodLabel("2026-01-01", "2026-01-31")).toBe(
      "Del 01 de enero de 2026 al 31 de enero de 2026"
    );
  });

  it("etiqueta un periodo de un solo día como corte", () => {
    expect(formatPeriodLabel("2026-03-05", "2026-03-05")).toBe("Al 05 de marzo de 2026");
  });

  it("devuelve cadena vacía si falta alguna fecha", () => {
    expect(formatPeriodLabel("", "2026-01-31")).toBe("");
  });
});
