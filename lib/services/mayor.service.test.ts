import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  construirQueryMayor,
  ErrorApi,
  obtenerLibroMayor,
  type LibroMayor,
} from "./mayor.service";

const LIBRO: LibroMayor = {
  cuenta: { codigo: "101", nombre: "Caja", tipo: "Activo" },
  saldoAnterior: 0,
  saldoFinal: 118,
  totales: { debe: 118, haber: 0, movimientos: 1 },
  movimientos: [
    {
      id: 71,
      idAsiento: 7,
      numero: "MISC/2025/06/0007",
      fecha: "2025-06-18",
      glosa: "Venta mostrador",
      descripcion: "Cobro en efectivo",
      modulo: "Facturas de cliente",
      referencia: "Factura 001-461",
      estado: "Registrado",
      debe: 118,
      haber: 0,
      saldo: 118,
      tipoSaldo: "deudor",
    },
  ],
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

describe("construirQueryMayor (libro mayor)", () => {
  it("siempre envía la cuenta consultada", () => {
    expect(construirQueryMayor({ codigo: "101" })).toBe("codigo=101");
  });

  it("serializa el periodo completo", () => {
    const params = new URLSearchParams(
      construirQueryMayor({ codigo: "101", desde: "2025-05-01", hasta: "2025-06-30" })
    );

    expect(params.get("codigo")).toBe("101");
    expect(params.get("desde")).toBe("2025-05-01");
    expect(params.get("hasta")).toBe("2025-06-30");
  });

  it("omite los extremos de fecha vacíos", () => {
    const params = new URLSearchParams(
      construirQueryMayor({ codigo: "201", hasta: "2025-06-30" })
    );

    expect(params.get("desde")).toBeNull();
    expect(params.get("hasta")).toBe("2025-06-30");
  });
});

describe("obtenerLibroMayor", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta /api/mayor con la cuenta y el periodo, sin caché", async () => {
    fetchMock.mockResolvedValue(respuestaJson(LIBRO));

    const resultado = await obtenerLibroMayor({
      codigo: "101",
      desde: "2025-05-01",
    });

    expect(resultado).toEqual(LIBRO);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mayor?codigo=101&desde=2025-05-01",
      { cache: "no-store" }
    );
  });

  it("consulta /api/mayor sólo con la cuenta cuando no hay periodo", async () => {
    fetchMock.mockResolvedValue(respuestaJson(LIBRO));

    await obtenerLibroMayor({ codigo: "101" });

    expect(fetchMock).toHaveBeenCalledWith("/api/mayor?codigo=101", { cache: "no-store" });
  });

  it("propaga el error del servidor como ErrorApi con sus validaciones", async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({ error: "La fecha inicial no puede ser posterior a la fecha final." }, 400)
    );

    const error = await errorDe(
      obtenerLibroMayor({ codigo: "101", desde: "2025-06-30", hasta: "2025-05-01" })
    );

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.message).toBe("La fecha inicial no puede ser posterior a la fecha final.");
  });
});
