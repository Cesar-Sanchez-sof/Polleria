import { describe, expect, it } from "vitest";
import type { AssistantConfig } from "@/lib/ai-assistant/config";
import { readOpenAiConfig } from "@/lib/ai-assistant/openai";
import { handleQuery, handleStatus, type ProxyDeps } from "@/lib/ai-assistant/proxy";

const DISABLED_R: AssistantConfig = { enabled: false, reason: "disabled" };

function deps(fetchFn: typeof fetch, overrides: Partial<ProxyDeps> = {}): ProxyDeps {
  return {
    config: DISABLED_R,
    session: async () => ({ userId: 7, username: "admin", role: "ADMIN" }),
    fetchFn,
    now: () => new Date("2026-10-13T03:30:00Z"),
    newTraceId: () => "erp-00000000000000000000000000000001",
    ...overrides,
  };
}

describe("GPT Luna y selector de modelos", () => {
  const OPENAI_KEY = "test-openai-key";

  it("sin OPENAI_API_KEY queda deshabilitado; con clave usa gpt-6-luna por defecto", () => {
    expect(readOpenAiConfig({}).enabled).toBe(false);
    expect(readOpenAiConfig({ OPENAI_API_KEY: OPENAI_KEY })).toEqual({ enabled: true, apiKey: OPENAI_KEY, model: "gpt-6-luna" });
  });

  it("el estado lista los modelos habilitados en orden", async () => {
    const d = deps(fetch, {
      config: { enabled: true, serviceUrl: "http://127.0.0.1:8001", token: "ab".repeat(32), identityKey: null, realData: false, demo: true, mode: "demo", timeoutMs: 1000, allowedUserIds: null },
      openai: readOpenAiConfig({ OPENAI_API_KEY: OPENAI_KEY }),
    });
    const result = await handleStatus(d);
    expect((result.body.modelos as { id: string }[]).map((m) => m.id)).toEqual(["modelo-r", "gpt-luna"]);
    expect(result.body.modeloPredeterminado).toBe("modelo-r");
    expect(JSON.stringify(result.body)).not.toContain(OPENAI_KEY);
  });

  it("responde con GPT Luna enviando la clave solo en la cabecera hacia OpenAI", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "Hola desde Luna" }] }] });
    }) as typeof fetch;
    const result = await handleQuery(
      JSON.stringify({ mensaje: "Hola", modelo: "gpt-luna" }),
      deps(fetchFn, { openai: readOpenAiConfig({ OPENAI_API_KEY: OPENAI_KEY }) }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ estado: "respondida", texto: "Hola desde Luna", detalle: null });
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(String(calls[0].init.body)).not.toContain(OPENAI_KEY);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(JSON.parse(String(calls[0].init.body)).model).toBe("gpt-6-luna");
  });

  it("un rol no permitido recibe 403 sin llamar a OpenAI", async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), Response.json({}))) as typeof fetch;
    const d = deps(fetchFn, { openai: readOpenAiConfig({ OPENAI_API_KEY: OPENAI_KEY }), session: async () => ({ userId: 9, username: "c", role: "CAJERO" }) });
    expect((await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "gpt-luna" }), d)).status).toBe(403);
    expect(called).toBe(false);
  });

  it("modelo desconocido → 404 y Modelo R deshabilitado → 404", async () => {
    const fetchFn = (async () => Response.json({})) as typeof fetch;
    expect((await handleQuery(JSON.stringify({ mensaje: "Saldo de caja" }), deps(fetchFn))).status).toBe(404);
    expect((await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "otro" }), deps(fetchFn))).status).toBe(404);
  });

  it("GPT Luna sin clave → 404 sin llamar a OpenAI", async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), Response.json({}))) as typeof fetch;
    expect((await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "gpt-luna" }), deps(fetchFn))).status).toBe(404);
    expect(called).toBe(false);
  });
});

describe("catálogo del selector", () => {
  it("el estado incluye todos los modelos y marca cuáles están disponibles", async () => {
    const result = await handleStatus(deps(fetch));
    expect(result.body.catalogo).toEqual([
      expect.objectContaining({ id: "modelo-r", disponible: false }),
      expect.objectContaining({ id: "gemini-erp", disponible: false }),
      expect.objectContaining({ id: "groq-erp", disponible: false }),
      expect.objectContaining({ id: "gpt-luna", disponible: false, proximamente: true }),
    ]);
  });
});

describe("Gemini + ERP (agente de solo lectura en ai-service)", () => {
  const TRACE = "erp-00000000000000000000000000000001";
  const R_ON: AssistantConfig = {
    enabled: true, serviceUrl: "http://127.0.0.1:8001", token: "ab".repeat(32), identityKey: "cd".repeat(32),
    realData: true, demo: true, mode: "demo", timeoutMs: 1000, allowedUserIds: null,
  };
  const agentBody = (over: Record<string, unknown> = {}) => ({
    id_traza: TRACE, estado: "respondida", texto: "Encontré 1 resultado(s).",
    tabla: { columnas: ["code", "total"], filas: [["101", "1800.00"]] }, sql: "SELECT 1", ...over,
  });
  const ask = (fetchFn: typeof fetch, overrides: Partial<ProxyDeps> = {}) =>
    handleQuery(JSON.stringify({ mensaje: "Saldo de caja", modelo: "gemini-erp" }), deps(fetchFn, { config: R_ON, geminiErp: true, ...overrides }));

  it("solo aparece con ai-service, identidad firmada y la bandera AI_GEMINI_SQL", async () => {
    const ids = async (d: ProxyDeps) => ((await handleStatus(d)).body.modelos as { id: string }[]).map((m) => m.id);
    expect(await ids(deps(fetch, { config: R_ON, geminiErp: true }))).toContain("gemini-erp");
    expect(await ids(deps(fetch, { config: R_ON }))).not.toContain("gemini-erp");
    expect(await ids(deps(fetch, { config: { ...R_ON, identityKey: null }, geminiErp: true }))).not.toContain("gemini-erp");
    expect(await ids(deps(fetch, { geminiErp: true }))).not.toContain("gemini-erp");
  });

  it("el Modelo R se puede ocultar sin afectar a Gemini + ERP", async () => {
    const ids = async (d: ProxyDeps) => ((await handleStatus(d)).body.modelos as { id: string }[]).map((m) => m.id);
    expect(await ids(deps(fetch, { config: R_ON, geminiErp: true, modelR: false }))).toEqual(["gemini-erp"]);
    expect(await ids(deps(fetch, { config: R_ON, geminiErp: true }))).toContain("modelo-r");
    const blocked = await handleQuery(JSON.stringify({ mensaje: "Saldo de caja", modelo: "modelo-r" }), deps(fetch, { config: R_ON, modelR: false }));
    expect(blocked.status).toBe(404);
  });

  it("envía la consulta a /v1/agent/queries con token e identidad firmada y devuelve la tabla", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json(agentBody());
    }) as typeof fetch;
    const result = await ask(fetchFn);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ estado: "respondida", detalle: null, sql: "SELECT 1" });
    expect(result.body.tabla).toEqual({ columnas: ["code", "total"], filas: [["101", "1800.00"]] });
    expect(calls[0].url).toBe("http://127.0.0.1:8001/v1/agent/queries");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["X-Internal-Token"]).toBe(R_ON.token);
    expect(headers["X-ERP-Identity"]).toBeTruthy();
  });

  it("rechaza respuestas malformadas del servicio y mapea 429", async () => {
    for (const bad of [
      agentBody({ id_traza: "erp-99999999999999999999999999999999" }),
      agentBody({ tabla: { columnas: ["a"], filas: [["1", "2"]] } }),
      agentBody({ tabla: { columnas: ["a"], filas: [[5]] } }),
      agentBody({ estado: "solo_lectura" }),
      { ...agentBody(), extra: "x" },
    ]) {
      expect((await ask((async () => Response.json(bad)) as typeof fetch)).status).toBe(502);
    }
    expect((await ask((async () => new Response("{}", { status: 429 })) as typeof fetch)).status).toBe(429);
    expect((await ask((async () => new Response("{}", { status: 500 })) as typeof fetch)).status).toBe(503);
  });

  it("sin la bandera responde 404 sin llamar al servicio", async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), Response.json(agentBody()))) as typeof fetch;
    expect((await ask(fetchFn, { geminiErp: false })).status).toBe(404);
    expect(called).toBe(false);
  });
});

describe("Groq + ERP (mismo agente de solo lectura, otra ruta en ai-service)", () => {
  const TRACE = "erp-00000000000000000000000000000001";
  const R_ON: AssistantConfig = {
    enabled: true, serviceUrl: "http://127.0.0.1:8001", token: "ab".repeat(32), identityKey: "cd".repeat(32),
    realData: true, demo: true, mode: "demo", timeoutMs: 1000, allowedUserIds: null,
  };
  const body = { id_traza: TRACE, estado: "respondida", texto: "Encontré 1 resultado(s).", tabla: { columnas: ["total"], filas: [["19"]] }, sql: "SELECT 1" };
  const ask = (fetchFn: typeof fetch, overrides: Partial<ProxyDeps> = {}) =>
    handleQuery(JSON.stringify({ mensaje: "cuantos asientos hay", modelo: "groq-erp" }), deps(fetchFn, { config: R_ON, groqErp: true, ...overrides }));
  const ids = async (d: ProxyDeps) => ((await handleStatus(d)).body.modelos as { id: string }[]).map((m) => m.id);

  it("solo aparece con ai-service, identidad firmada y la bandera AI_GROQ_SQL", async () => {
    expect(await ids(deps(fetch, { config: R_ON, groqErp: true }))).toContain("groq-erp");
    expect(await ids(deps(fetch, { config: R_ON }))).not.toContain("groq-erp");
    expect(await ids(deps(fetch, { config: { ...R_ON, identityKey: null }, groqErp: true }))).not.toContain("groq-erp");
    expect(await ids(deps(fetch, { groqErp: true }))).not.toContain("groq-erp");
  });

  it("Gemini + ERP y Groq + ERP son independientes y el Modelo R se puede ocultar", async () => {
    expect(await ids(deps(fetch, { config: R_ON, geminiErp: true, groqErp: true, modelR: false }))).toEqual(["gemini-erp", "groq-erp"]);
    expect(await ids(deps(fetch, { config: R_ON, geminiErp: true, modelR: false }))).toEqual(["gemini-erp"]);
    expect(await ids(deps(fetch, { config: R_ON, groqErp: true, modelR: false }))).toEqual(["groq-erp"]);
  });

  it("envía la consulta a /v1/agent/groq/queries con token e identidad firmada y devuelve la tabla", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json(body);
    }) as typeof fetch;
    const result = await ask(fetchFn);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ estado: "respondida", detalle: null, sql: "SELECT 1" });
    expect(result.body.tabla).toEqual({ columnas: ["total"], filas: [["19"]] });
    expect(calls[0].url).toBe("http://127.0.0.1:8001/v1/agent/groq/queries");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["X-Internal-Token"]).toBe(R_ON.token);
    expect(headers["X-ERP-Identity"]).toBeTruthy();
  });

  it("Gemini + ERP sigue usando su propia ruta", async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string | URL | Request) => (calls.push(String(url)), Response.json(body))) as typeof fetch;
    await handleQuery(JSON.stringify({ mensaje: "cuantos asientos hay", modelo: "gemini-erp" }), deps(fetchFn, { config: R_ON, geminiErp: true, groqErp: true }));
    expect(calls).toEqual(["http://127.0.0.1:8001/v1/agent/queries"]);
  });

  it("rechaza respuestas malformadas del servicio y mapea 429/5xx", async () => {
    for (const bad of [{ ...body, id_traza: "erp-99999999999999999999999999999999" }, { ...body, tabla: { columnas: ["a"], filas: [["1", "2"]] } }, { ...body, extra: "x" }]) {
      expect((await ask((async () => Response.json(bad)) as typeof fetch)).status).toBe(502);
    }
    expect((await ask((async () => new Response("{}", { status: 429 })) as typeof fetch)).status).toBe(429);
    expect((await ask((async () => new Response("{}", { status: 500 })) as typeof fetch)).status).toBe(503);
  });

  it("sin la bandera responde 404 sin llamar al servicio y un rol no permitido recibe 403", async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), Response.json(body))) as typeof fetch;
    expect((await ask(fetchFn, { groqErp: false })).status).toBe(404);
    expect((await ask(fetchFn, { session: async () => ({ userId: 9, username: "c", role: "CAJERO" }) })).status).toBe(403);
    expect(called).toBe(false);
  });
});
