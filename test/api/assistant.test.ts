import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";

const currentSession = vi.fn();
vi.mock("@/lib/auth/current-session", () => ({ currentSession: () => currentSession() }));

// Los interruptores viven en la BD (`developer_setting`), no en el entorno: aquí se simulan en memoria.
const flags: Record<string, boolean> = {};
vi.mock("@/lib/services/settings/developer-settings.service", () => ({ getDeveloperFlags: async () => ({ ...flags }) }));

const FLAG_BY_NAME: Readonly<Record<string, string>> = {
  AI_ASSISTANT_DEMO: "assistant.demo",
  AI_ASSISTANT_EVAL_ENABLED: "assistant.eval",
  AI_ASSISTANT_ALLOW_PRODUCTION_EVAL: "assistant.allow_production_eval",
  AI_ASSISTANT_REAL_DATA: "assistant.real_data",
  AI_ASSISTANT_DIAGNOSTICS: "assistant.diagnostics",
};

/** Como `vi.stubEnv`, pero los nombres de interruptor (solo `"1"` enciende) van al simulacro de la BD. */
function stubEnv(name: string, value: string | undefined) {
  const flag = FLAG_BY_NAME[name];
  if (flag) flags[flag] = value === "1";
  else vi.stubEnv(name, value);
}

function unstubAll() {
  for (const key of Object.keys(flags)) delete flags[key];
  vi.unstubAllEnvs();
}

import { GET, maxDuration, POST } from "@/app/api/assistant/route";
import { EVAL_NGROK_URL, EVAL_TIMEOUT_MS } from "@/lib/ai-assistant/config";

const TOKEN = "ef".repeat(32);

/** Sin modelos disponibles el globo sigue visible: el estado responde 200 con la lista vacía. */
async function expectNoModels(label: string) {
  const response = await GET();
  expect(response.status, label).toBe(200);
  expect(await response.json(), label).toMatchObject({ enabled: true, modelos: [] });
  currentSession.mockClear(); // el POST deshabilitado no debe consultar la sesión
}

function post(body: string, contentType = "application/json") {
  return POST(new Request("http://localhost/api/assistant", { method: "POST", headers: { "Content-Type": contentType }, body }));
}

describe("/api/assistant", () => {
  beforeEach(() => {
    stubEnv("NODE_ENV", "development");
    stubEnv("AI_ASSISTANT_DEMO", "1");
    stubEnv("AI_SERVICE_URL", "http://127.0.0.1:8001");
    stubEnv("AI_SERVICE_INTERNAL_TOKEN", TOKEN);
    currentSession.mockResolvedValue({ userId: 7, username: "admin", role: "ADMIN" });
  });

  afterEach(() => {
    unstubAll();
    vi.unstubAllGlobals();
    currentSession.mockReset();
  });

  it("GET habilitado en demostración local con ADMIN, sin exponer el token", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ enabled: true, fakeData: true });
    expect(text).not.toContain(TOKEN);
  });

  it("deshabilitado en producción aunque exista el modo demostración", async () => {
    stubEnv("NODE_ENV", "production");
    await expectNoModels("producción");
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(404);
    expect(currentSession).not.toHaveBeenCalled();
  });

  it("GET y POST exigen sesión y rol ADMIN", async () => {
    currentSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(401);
    currentSession.mockResolvedValue({ userId: 9, username: "caja", role: "CAJERO" });
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

describe("/api/assistant en evaluación académica (Vercel Preview → túnel HTTPS)", () => {
  const TUNNEL = "https://ejemplo-ficticio-evaluacion.trycloudflare.com";
  const IDENTITY_KEY = "12".repeat(32);

  beforeEach(() => {
    // Así ejecuta Vercel un despliegue Preview: NODE_ENV=production y VERCEL_ENV=preview.
    stubEnv("NODE_ENV", "production");
    stubEnv("VERCEL_ENV", "preview");
    stubEnv("AI_ASSISTANT_EVAL_ENABLED", "1");
    stubEnv("AI_SERVICE_URL", TUNNEL);
    stubEnv("AI_SERVICE_INTERNAL_TOKEN", TOKEN);
    stubEnv("AI_ASSISTANT_IDENTITY_KEY", IDENTITY_KEY);
    currentSession.mockResolvedValue({ userId: 7, username: "admin", role: "ADMIN" });
  });

  afterEach(() => {
    unstubAll();
    vi.unstubAllGlobals();
    currentSession.mockReset();
  });

  it("habilitado en Preview solo para ADMIN y siempre con datos ficticios", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ enabled: true, fakeData: true });
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(IDENTITY_KEY);
    currentSession.mockResolvedValue({ userId: 9, username: "caja", role: "CAJERO" });
    expect((await GET()).status).toBe(403);
    currentSession.mockResolvedValue(null);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(401);
  });

  it("bloqueado sin la bandera, en Production, fuera de Vercel o si se piden datos reales", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const blocked: Array<[string, string | undefined]> = [
      ["AI_ASSISTANT_EVAL_ENABLED", undefined],
      ["VERCEL_ENV", "production"],
      ["VERCEL_ENV", undefined],
      ["AI_ASSISTANT_REAL_DATA", "1"],
      ["AI_SERVICE_URL", "http://ejemplo.trycloudflare.com"],
      ["AI_SERVICE_URL", "https://otro-dominio.example.com"],
      ["AI_SERVICE_URL", "https://otro-subdominio.ngrok-free.dev"],
      ["AI_SERVICE_URL", `${EVAL_NGROK_URL}/v1`],
      ["AI_ASSISTANT_IDENTITY_KEY", undefined],
    ];
    for (const [name, value] of blocked) {
      stubEnv(name, value);
      await expectNoModels(`${name}=${value}`);
      expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status, `${name}=${value}`).toBe(404);
      stubEnv("AI_ASSISTANT_EVAL_ENABLED", "1");
      stubEnv("VERCEL_ENV", "preview");
      stubEnv("AI_ASSISTANT_REAL_DATA", undefined);
      stubEnv("AI_SERVICE_URL", TUNNEL);
      stubEnv("AI_ASSISTANT_IDENTITY_KEY", IDENTITY_KEY);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(currentSession).not.toHaveBeenCalled();
  });

  it("POST llega a FastAPI por el túnel con token interno e identidad firmada (P-9)", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return Response.json({
        id_traza: sent.id_traza, estado: "sin_datos", texto: "No encontré movimientos.", cifras: [], evidencias: [], versiones: {}, detalle: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(JSON.stringify({ mensaje: "Saldo de caja en julio" }));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${TUNNEL}/v1/queries`);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Internal-Token"]).toBe(TOKEN);
    expect(headers["X-ERP-Identity"]).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body)).usuario).toEqual({ id: 7, rol: "contador_demo" });
    expect(JSON.stringify(await response.json())).not.toContain(TOKEN);
  });

  it("POST llega a FastAPI por el dominio estático de ngrok con token interno e identidad firmada (P-9)", async () => {
    stubEnv("AI_SERVICE_URL", EVAL_NGROK_URL);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => Response.json({
      id_traza: JSON.parse(String(init.body)).id_traza, estado: "sin_datos", texto: "No encontré movimientos.",
      cifras: [], evidencias: [], versiones: {}, detalle: null,
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await post(JSON.stringify({ mensaje: "Saldo de caja en julio" }))).status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${EVAL_NGROK_URL}/v1/queries`);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Internal-Token"]).toBe(TOKEN);
    const { payload } = await jwtVerify(headers["X-ERP-Identity"], Buffer.from(IDENTITY_KEY, "hex"), {
      issuer: "polleria-erp", audience: "ai-service", algorithms: ["HS256"],
    });
    expect(payload).toMatchObject({ sub: "7", rol: "contador_demo", jti: JSON.parse(String(init.body)).id_traza });
    expect(init.redirect).toBe("error");
  });

  it("el proxy corta antes que el límite de la función en Vercel", () => {
    expect(maxDuration).toBe(60);
    expect(EVAL_TIMEOUT_MS).toBeLessThan(maxDuration * 1000);
  });
});

describe("/api/assistant en Vercel Production (evaluación académica temporal)", () => {
  const TUNNEL = "https://produccion-ficticia-eval.trycloudflare.com";
  const IDENTITY_KEY = "34".repeat(32);
  const ERP_SESSION_SECRET = "secreto-de-sesion-del-erp-ficticio-0123456789";

  function both() {
    stubEnv("AI_ASSISTANT_EVAL_ENABLED", "1");
    stubEnv("AI_ASSISTANT_ALLOW_PRODUCTION_EVAL", "1");
  }

  function answering() {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return Response.json({
        id_traza: sent.id_traza, estado: "sin_datos", texto: "No encontré movimientos.", cifras: [], evidencias: [], versiones: {}, detalle: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  beforeEach(() => {
    stubEnv("NODE_ENV", "production");
    stubEnv("VERCEL_ENV", "production");
    stubEnv("AI_SERVICE_URL", TUNNEL);
    stubEnv("AI_SERVICE_INTERNAL_TOKEN", TOKEN);
    stubEnv("AI_ASSISTANT_IDENTITY_KEY", IDENTITY_KEY);
    stubEnv("SESSION_SECRET", ERP_SESSION_SECRET); // login del ERP: el asistente no la usa
    stubEnv("AI_ASSISTANT_EVAL_USER_IDS", "7"); // cuenta evaluadora (idUsuario de la sesión ADMIN)
    currentSession.mockResolvedValue({ userId: 7, username: "admin", role: "ADMIN" });
  });

  afterEach(() => {
    unstubAll();
    vi.unstubAllGlobals();
    currentSession.mockReset();
  });

  it("deshabilitado por defecto y con una sola bandera", async () => {
    const fetchMock = answering();
    for (const flags of [{}, { AI_ASSISTANT_EVAL_ENABLED: "1" }, { AI_ASSISTANT_ALLOW_PRODUCTION_EVAL: "1" }]) {
      for (const [name, value] of Object.entries(flags)) stubEnv(name, value);
      await expectNoModels(JSON.stringify(flags));
      expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status, JSON.stringify(flags)).toBe(404);
      stubEnv("AI_ASSISTANT_EVAL_ENABLED", undefined);
      stubEnv("AI_ASSISTANT_ALLOW_PRODUCTION_EVAL", undefined);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(currentSession).not.toHaveBeenCalled();
  });

  it("con ambas banderas: ADMIN autorizado y otros roles o sin sesión rechazados", async () => {
    both();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: true, fakeData: true });
    currentSession.mockResolvedValue({ userId: 9, username: "caja", role: "CAJERO" });
    expect((await GET()).status).toBe(403);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(403);
    currentSession.mockResolvedValue(null);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(401);
  });

  it("con ambas banderas: un ADMIN que no es la cuenta evaluadora recibe 403", async () => {
    both();
    const fetchMock = answering();
    currentSession.mockResolvedValue({ userId: 8, username: "otro-admin", role: "ADMIN" });
    expect((await GET()).status).toBe(403);
    expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("datos reales: solo con autorización explícita y cuentas evaluadoras; el estado lo indica", async () => {
    both();
    const fetchMock = answering();
    stubEnv("AI_ASSISTANT_REAL_DATA", "1");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: true, fakeData: false });
    expect((await post(JSON.stringify({ mensaje: "Saldo de caja en julio" }))).status).toBe(200);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)["X-ERP-Identity"]).toBeTruthy(); // P-9 siempre
    stubEnv("AI_ASSISTANT_EVAL_USER_IDS", undefined);
    await expectNoModels("sin cuentas evaluadoras"); // deshabilitado
  });

  it("con ambas banderas sigue bloqueado sin cuentas evaluadoras, sin P-9 o fuera del túnel", async () => {
    both();
    const fetchMock = answering();
    for (const [name, value] of [
      ["AI_ASSISTANT_EVAL_USER_IDS", undefined],
      ["AI_ASSISTANT_EVAL_USER_IDS", "admin"],
      ["AI_ASSISTANT_IDENTITY_KEY", undefined],
      ["AI_SERVICE_URL", "http://127.0.0.1:8001"],
      ["VERCEL_ENV", "development"],
    ] as Array<[string, string | undefined]>) {
      stubEnv(name, value);
      await expectNoModels(`${name}=${value}`);
      expect((await post(JSON.stringify({ mensaje: "Saldo" }))).status, `${name}=${value}`).toBe(404);
      stubEnv("AI_ASSISTANT_EVAL_USER_IDS", "7");
      stubEnv("AI_ASSISTANT_IDENTITY_KEY", IDENTITY_KEY);
      stubEnv("AI_SERVICE_URL", TUNNEL);
      stubEnv("VERCEL_ENV", "production");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mantiene token interno y P-9 con su propia clave; SESSION_SECRET del ERP no interviene", async () => {
    both();
    const fetchMock = answering();
    expect((await post(JSON.stringify({ mensaje: "Saldo de caja en julio" }))).status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${TUNNEL}/v1/queries`);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Internal-Token"]).toBe(TOKEN);
    const identity = headers["X-ERP-Identity"];
    const { payload } = await jwtVerify(identity, Buffer.from(IDENTITY_KEY, "hex"), {
      issuer: "polleria-erp", audience: "ai-service", algorithms: ["HS256"],
    });
    expect(payload).toMatchObject({ sub: "7", rol: "contador_demo" });
    await expect(jwtVerify(identity, new TextEncoder().encode(ERP_SESSION_SECRET))).rejects.toThrow();
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(ERP_SESSION_SECRET);
    expect(process.env.SESSION_SECRET).toBe(ERP_SESSION_SECRET); // no se modifica
  });
});
