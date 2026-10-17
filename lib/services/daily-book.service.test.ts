import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDailyBookQuery,
  ApiError,
  listDailyBookEntries,
  type DailyBookPage,
} from "./daily-book.service";

const PAGE_DATA: DailyBookPage = {
  data: [
    {
      id: 7,
      number: "MISC/2025/06/0007",
      date: "2025-06-18",
      daily: "Operaciones varias",
      concept: "Asiento 7",
      responsible: "Leandro Mauricci",
      status: "Registrado",
      totals: { debit: 118, credit: 118 },
      balanced: true,
      lines: [
        {
          id: 71,
          accountCode: "101",
          accountName: "Caja",
          accountType: "Activo",
          description: "Cobro en efectivo",
          debit: 118,
          credit: 0,
        },
      ],
    },
  ],
  meta: { total: 36, page: 1, pageSize: 10, totalPages: 4, from: "", to: "" },
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

describe("buildDailyBookQuery (libro diario)", () => {
  it("omite los filtros vacíos", () => {
    expect(buildDailyBookQuery({})).toBe("");
  });

  it("serializa el periodo y la paginación", () => {
    const params = new URLSearchParams(
      buildDailyBookQuery({
        from: "2025-05-01",
        to: "2025-06-30",
        page: 2,
        pageSize: 25,
      })
    );

    expect(params.get("desde")).toBe("2025-05-01");
    expect(params.get("hasta")).toBe("2025-06-30");
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("25");
  });

  it("acepta un solo extremo del periodo", () => {
    const params = new URLSearchParams(buildDailyBookQuery({ to: "2025-06-30" }));

    expect(params.get("desde")).toBeNull();
    expect(params.get("hasta")).toBe("2025-06-30");
  });
});

describe("listDailyBookEntries", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta /api/daily-book con el periodo y sin caché", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(PAGE_DATA));

    const result = await listDailyBookEntries({ from: "2025-05-01", page: 2 });

    expect(result).toEqual(PAGE_DATA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/daily-book?desde=2025-05-01&page=2", {
      cache: "no-store",
    });
  });

  it("consulta /api/daily-book sin query cuando no hay filtros", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(PAGE_DATA));

    await listDailyBookEntries();

    expect(fetchMock).toHaveBeenCalledWith("/api/daily-book", { cache: "no-store" });
  });

  it("propaga el error del servidor como ErrorApi con sus validaciones", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({ error: "La fecha inicial no puede ser posterior a la fecha final." }, 400)
    );

    const error = await catchApiError(listDailyBookEntries({ from: "2025-06-30", to: "2025-05-01" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("La fecha inicial no puede ser posterior a la fecha final.");
  });
});
