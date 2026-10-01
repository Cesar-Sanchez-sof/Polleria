import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildQuery,
  ApiError,
  listJournalEntries,
  registerJournalEntry,
  type JournalEntrySummary,
  type SortDirection,
  type NewJournalEntryInput,
  type JournalEntriesFilter,
  type JournalEntrySort,
  type JournalEntriesPage,
} from "./journal-entries.service";

const PAGE_DATA: JournalEntriesPage = {
  data: [
    {
      id: 7,
      numero: "MISC/2025/06/0007",
      fecha: "2025-06-18",
      diario: "Operaciones varias",
      concepto: "Asiento 7",
      responsable: "Leandro Mauricci",
      estado: "Registrado",
      total: 300.25,
    },
  ],
  meta: {
    total: 36,
    registrados: 30,
    anulados: 6,
    page: 1,
    pageSize: 10,
    totalPaginas: 4,
    orden: "fecha",
    dir: "desc",
  },
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

describe("buildQuery (listar asientos)", () => {
  it("omite los filtros vacíos y fija el orden por defecto", () => {
    expect(buildQuery({})).toBe("orden=fecha&dir=desc");
  });

  it("serializa todos los filtros activos", () => {
    const params = new URLSearchParams(
      buildQuery({
        desde: "2025-05-01",
        hasta: "2025-06-30",
        diario: "Banco / Caja",
        estado: "registrado",
        q: "  caja  ",
        page: 2,
        pageSize: 25,
        orden: "total",
        dir: "asc",
      })
    );

    expect(params.get("desde")).toBe("2025-05-01");
    expect(params.get("hasta")).toBe("2025-06-30");
    expect(params.get("diario")).toBe("Banco / Caja");
    expect(params.get("estado")).toBe("registrado");
    expect(params.get("q")).toBe("caja");
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("25");
    expect(params.get("orden")).toBe("total");
    expect(params.get("dir")).toBe("asc");
  });

  it("descarta orden y dirección que no sean válidos", () => {
    const filters = {
      orden: "loquesea",
      dir: "ASC",
    } as unknown as JournalEntriesFilter;

    const params = new URLSearchParams(buildQuery(filters));

    expect(params.get("orden")).toBe("fecha");
    expect(params.get("dir")).toBe("desc");
  });

  it("conserva un orden válido aunque la dirección sea distinta", () => {
    const params = new URLSearchParams(
      buildQuery({ orden: "concepto" as JournalEntrySort, dir: "asc" as SortDirection })
    );

    expect(params.get("orden")).toBe("concepto");
    expect(params.get("dir")).toBe("asc");
  });
});

describe("listJournalEntries", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta /api/journal-entries con los filtros y sin caché", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(PAGE_DATA));

    const result = await listJournalEntries({ page: 2, orden: "concepto", dir: "asc" });

    expect(result).toEqual(PAGE_DATA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/journal-entries?page=2&orden=concepto&dir=asc", {
      cache: "no-store",
    });
  });

  it("usa los valores por defecto cuando no se envían filtros", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(PAGE_DATA));

    await listJournalEntries();

    expect(fetchMock).toHaveBeenCalledWith("/api/journal-entries?orden=fecha&dir=desc", {
      cache: "no-store",
    });
  });

  it("propaga el error del servidor como ErrorApi con sus validaciones", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(
        { error: "No se pudo obtener el listado de asientos contables.", errores: ["detalle 1"] },
        500
      )
    );

    const error = await catchApiError(listJournalEntries());

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("No se pudo obtener el listado de asientos contables.");
    expect(error.errors).toEqual(["detalle 1"]);
  });

  it("usa el propio mensaje como detalle cuando la respuesta no trae `errores`", async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ error: "Página no encontrada" }, 404));

    const error = await catchApiError(listJournalEntries());

    expect(error).toBeInstanceOf(ApiError);
    expect(error.errors).toEqual(["Página no encontrada"]);
  });

  it("informa de fallo de conexión si fetch se rechaza", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(listJournalEntries()).rejects.toThrow("No se pudo conectar con el servidor.");
  });

  it("usa un mensaje genérico si la respuesta no es JSON", async () => {
    fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

    await expect(listJournalEntries()).rejects.toThrow(
      "Error inesperado al consultar el servicio."
    );
  });
});

describe("registerJournalEntry", () => {
  const INPUT: NewJournalEntryInput = {
    fecha: "2026-09-27",
    diario: "Operaciones varias",
    glosa: "Caja chica: compra de insumos",
    responsable: "Leandro Mauricci",
    observacion: "Factura S001-000123",
    lineas: [
      { idCuenta: 7, descripcion: "Efectivo", debe: 118, haber: 0 },
      { idCuenta: 21, descripcion: "Compra de mercadería", debe: 0, haber: 100 },
      { idCuenta: 173, descripcion: "IGV por acreditar", debe: 0, haber: 18 },
    ],
  };

  const SUMMARY: JournalEntrySummary = {
    id: 501,
    numero: "MISC/2026/09/0001",
    fecha: "2026-09-27",
    diario: "Operaciones varias",
    concepto: "Caja chica: compra de insumos",
    responsable: "Leandro Mauricci",
    estado: "Registrado",
    total: 118,
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía el asiento en JSON a /api/journal-entries y devuelve su resumen", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(SUMMARY, 201));

    const result = await registerJournalEntry(INPUT);

    expect(result).toEqual(SUMMARY);
    expect(fetchMock).toHaveBeenCalledWith("/api/journal-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(INPUT),
    });
  });

  it("convierte las validaciones del servidor en un ErrorApi con cada detalle", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(
        {
          error: "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00).",
          errores: [
            "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00).",
            "Línea 2: los importes no pueden ser negativos.",
          ],
        },
        400
      )
    );

    const error = await catchApiError(registerJournalEntry(INPUT));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(
      "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00)."
    );
    expect(error.errors).toEqual([
      "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00).",
      "Línea 2: los importes no pueden ser negativos.",
    ]);
  });

  it("usa el propio mensaje como detalle cuando la respuesta no trae `errores`", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(
        { error: "Una o más cuentas contables del asiento no existen en el plan contable." },
        400
      )
    );

    const error = await catchApiError(registerJournalEntry(INPUT));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(
      "Una o más cuentas contables del asiento no existen en el plan contable."
    );
    expect(error.errors).toEqual([
      "Una o más cuentas contables del asiento no existen en el plan contable.",
    ]);
  });

  it("informa de fallo de conexión si fetch se rechaza", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(registerJournalEntry(INPUT)).rejects.toThrow(
      "No se pudo conectar con el servidor."
    );
  });
});
