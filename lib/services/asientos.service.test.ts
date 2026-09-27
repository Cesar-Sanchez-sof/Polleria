import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  construirQuery,
  ErrorApi,
  listarAsientos,
  registrarAsiento,
  type AsientoResumen,
  type DireccionOrden,
  type EntradaAsiento,
  type FiltroAsientos,
  type OrdenAsiento,
  type PaginaAsientos,
} from "./asientos.service";

const PAGINA: PaginaAsientos = {
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

/** Respuesta JSON con estado indicado. */
function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Ejecuta la petición y devuelve el ErrorApi lanzado (falla si no lanza). */
async function errorDe(peticion: Promise<unknown>): Promise<ErrorApi> {
  try {
    await peticion;
  } catch (error) {
    return error as ErrorApi;
  }
  throw new Error("La petición no lanzó el error esperado.");
}

const fetchMock = vi.fn();

describe("construirQuery (listar asientos)", () => {
  it("omite los filtros vacíos y fija el orden por defecto", () => {
    expect(construirQuery({})).toBe("orden=fecha&dir=desc");
  });

  it("serializa todos los filtros activos", () => {
    const params = new URLSearchParams(
      construirQuery({
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
    expect(params.get("q")).toBe("caja"); // sin espacios sobrantes
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("25");
    expect(params.get("orden")).toBe("total");
    expect(params.get("dir")).toBe("asc");
  });

  it("descarta orden y dirección que no sean válidos", () => {
    const filtros = {
      orden: "loquesea",
      dir: "ASC",
    } as unknown as FiltroAsientos;

    const params = new URLSearchParams(construirQuery(filtros));

    expect(params.get("orden")).toBe("fecha");
    expect(params.get("dir")).toBe("desc");
  });

  it("conserva un orden válido aunque la dirección sea distinta", () => {
    const params = new URLSearchParams(
      construirQuery({ orden: "concepto" as OrdenAsiento, dir: "asc" as DireccionOrden })
    );

    expect(params.get("orden")).toBe("concepto");
    expect(params.get("dir")).toBe("asc");
  });
});

describe("listarAsientos", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta /api/asientos con los filtros y sin caché", async () => {
    fetchMock.mockResolvedValue(respuestaJson(PAGINA));

    const resultado = await listarAsientos({ page: 2, orden: "concepto", dir: "asc" });

    expect(resultado).toEqual(PAGINA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/asientos?page=2&orden=concepto&dir=asc", {
      cache: "no-store",
    });
  });

  it("usa los valores por defecto cuando no se envían filtros", async () => {
    fetchMock.mockResolvedValue(respuestaJson(PAGINA));

    await listarAsientos();

    expect(fetchMock).toHaveBeenCalledWith("/api/asientos?orden=fecha&dir=desc", {
      cache: "no-store",
    });
  });

  it("propaga el error del servidor como ErrorApi con sus validaciones", async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
        { error: "No se pudo obtener el listado de asientos contables.", errores: ["detalle 1"] },
        500
      )
    );

    const error = await errorDe(listarAsientos());

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.message).toBe("No se pudo obtener el listado de asientos contables.");
    expect(error.errores).toEqual(["detalle 1"]);
  });

  it("usa el propio mensaje como detalle cuando la respuesta no trae `errores`", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "Página no encontrada" }, 404));

    const error = await errorDe(listarAsientos());

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.errores).toEqual(["Página no encontrada"]);
  });

  it("informa de fallo de conexión si fetch se rechaza", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(listarAsientos()).rejects.toThrow("No se pudo conectar con el servidor.");
  });

  it("usa un mensaje genérico si la respuesta no es JSON", async () => {
    fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

    await expect(listarAsientos()).rejects.toThrow(
      "Error inesperado al consultar el servicio."
    );
  });
});

describe("registrarAsiento", () => {
  /** Asiento que envía el diálogo de alta manual. */
  const ENTRADA: EntradaAsiento = {
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

  const RESUMEN: AsientoResumen = {
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

  it("envía el asiento en JSON a /api/asientos y devuelve su resumen", async () => {
    fetchMock.mockResolvedValue(respuestaJson(RESUMEN, 201));

    const resultado = await registrarAsiento(ENTRADA);

    expect(resultado).toEqual(RESUMEN);
    expect(fetchMock).toHaveBeenCalledWith("/api/asientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ENTRADA),
    });
  });

  it("convierte las validaciones del servidor en un ErrorApi con cada detalle", async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
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

    const error = await errorDe(registrarAsiento(ENTRADA));

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.message).toBe(
      "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00)."
    );
    expect(error.errores).toEqual([
      "El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00).",
      "Línea 2: los importes no pueden ser negativos.",
    ]);
  });

  it("usa el propio mensaje como detalle cuando la respuesta no trae `errores`", async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
        { error: "Una o más cuentas contables del asiento no existen en el plan contable." },
        400
      )
    );

    const error = await errorDe(registrarAsiento(ENTRADA));

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.message).toBe(
      "Una o más cuentas contables del asiento no existen en el plan contable."
    );
    expect(error.errores).toEqual([
      "Una o más cuentas contables del asiento no existen en el plan contable.",
    ]);
  });

  it("informa de fallo de conexión si fetch se rechaza", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(registrarAsiento(ENTRADA)).rejects.toThrow(
      "No se pudo conectar con el servidor."
    );
  });
});
