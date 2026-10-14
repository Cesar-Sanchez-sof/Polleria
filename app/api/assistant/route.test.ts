import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sesionActual = vi.fn();
vi.mock("@/lib/auth/sesion-actual", () => ({ sesionActual: () => sesionActual() }));

import { GET, POST } from "@/app/api/assistant/route";

const TOKEN = "ef".repeat(32);

function post(body: string, contentType = "application/json") {
  return POST(new Request("http://localhost/api/assistant", { method: "POST", headers: { "Content-Type": contentType }, body }));
}

describe("/api/assistant", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_ASSISTANT_DEMO", "1");
    vi.stubEnv("AI_SERVICE_URL", "http://127.0.0.1:8001");
    vi.stubEnv("AI_SERVICE_INTERNAL_TOKEN", TOKEN);
    sesionActual.mockResolvedValue({ idUsuario: 7, username: "admin", rol: "ADMIN" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    sesionActual.mockReset();
  });

  it("GET habilitado en demostración local con ADMIN, sin exponer el token", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ habilitado: true, datosFicticios: true });
    expect(text).not.toContain(TOKEN);
  });

  it("deshabilitado en producción aunque exista el modo demostración", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET()).status).toBe(404);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(404);
    expect(sesionActual).not.toHaveBeenCalled();
  });

  it("GET y POST exigen sesión y rol ADMIN", async () => {
    sesionActual.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(401);
    sesionActual.mockResolvedValue({ idUsuario: 9, username: "caja", rol: "CAJERO" });
    expect((await GET()).status).toBe(403);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(403);
  });

  it("POST reenvía al servicio local con el token en la cabecera", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return Response.json({
        id_traza: sent.id_traza,
        estado: "sin_datos",
        texto: "No encontré movimientos de esa cuenta en el período que consultaste.",
        cifras: [],
        evidencias: [],
        versiones: {},
        detalle: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(JSON.stringify({ mensaje: "Saldo de caja en julio" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ estado: "sin_datos", detalle: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8001/v1/queries");
    expect((init.headers as Record<string, string>)["X-Internal-Token"]).toBe(TOKEN);
    expect(JSON.parse(String(init.body)).usuario).toEqual({ id: 7, rol: "contador_demo" });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it("rechaza formatos no JSON y cuerpos demasiado grandes", async () => {
    expect((await post("mensaje=hola", "text/plain")).status).toBe(415);
    const big = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(64 * 1024) },
      body: "{}",
    });
    expect((await POST(big)).status).toBe(413);
  });
});
