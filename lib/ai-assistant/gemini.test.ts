import { describe, expect, it } from "vitest";
import type { AssistantConfig } from "@/lib/ai-assistant/config";
import { readGeminiConfig } from "@/lib/ai-assistant/gemini";
import { readOpenAiConfig } from "@/lib/ai-assistant/openai";
import { handleQuery, handleStatus, type ProxyDeps } from "@/lib/ai-assistant/proxy";

const DISABLED_R: AssistantConfig = { enabled: false, reason: "disabled" };
const KEY = "test-gemini-key";

function deps(fetchFn: typeof fetch, overrides: Partial<ProxyDeps> = {}): ProxyDeps {
  return {
    config: DISABLED_R,
    gemini: readGeminiConfig({ GEMINI_API_KEY: KEY }),
    session: async () => ({ userId: 7, username: "admin", role: "ADMIN" }),
    fetchFn,
    now: () => new Date("2026-10-13T03:30:00Z"),
    newTraceId: () => "erp-00000000000000000000000000000001",
    ...overrides,
  };
}

describe("Gemini", () => {
  it("sin GEMINI_API_KEY queda deshabilitado; con clave usa gemini-3.5-flash por defecto", () => {
    expect(readGeminiConfig({}).enabled).toBe(false);
    expect(readGeminiConfig({ GEMINI_API_KEY: KEY })).toEqual({ enabled: true, apiKey: KEY, model: "gemini-3.5-flash" });
  });

  it("el estado lista solo los modelos disponibles y no expone la clave", async () => {
    const result = await handleStatus(deps(fetch));
    expect(result.status).toBe(200);
    expect((result.body.modelos as { id: string }[]).map((m) => m.id)).toEqual(["gemini"]);
    expect(result.body.modeloPredeterminado).toBe("gemini");
    expect(JSON.stringify(result.body)).not.toContain(KEY);
  });

  it("responde con Gemini enviando la clave solo en la cabecera hacia Google", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({ candidates: [{ content: { parts: [{ text: "Hola, ¿en qué te ayudo?" }] } }] });
    }) as typeof fetch;
    const result = await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "gemini" }), deps(fetchFn));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ estado: "respondida", texto: "Hola, ¿en qué te ayudo?", detalle: null });
    expect(calls[0].url).toContain("gemini-3.5-flash:generateContent");
    expect(calls[0].url).not.toContain(KEY);
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
  });

  it("Modelo R deshabilitado → 404 aunque Gemini esté activo; modelo desconocido → 400", async () => {
    const fetchFn = (async () => Response.json({})) as typeof fetch;
    expect((await handleQuery(JSON.stringify({ mensaje: "Saldo de caja" }), deps(fetchFn))).status).toBe(404);
    expect((await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "otro" }), deps(fetchFn))).status).toBe(404);
  });

  it("un rol no permitido recibe 403 sin llamar a Google", async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), Response.json({}))) as typeof fetch;
    const d = deps(fetchFn, { session: async () => ({ userId: 9, username: "c", role: "CAJERO" }) });
    expect((await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "gemini" }), d)).status).toBe(403);
    expect(called).toBe(false);
  });
});

describe("GPT Luna y selector de modelos", () => {
  const OPENAI_KEY = "test-openai-key";

  it("sin OPENAI_API_KEY queda deshabilitado; con clave usa gpt-6-luna por defecto", () => {
    expect(readOpenAiConfig({}).enabled).toBe(false);
    expect(readOpenAiConfig({ OPENAI_API_KEY: OPENAI_KEY })).toEqual({ enabled: true, apiKey: OPENAI_KEY, model: "gpt-6-luna" });
  });

  it("el estado lista los tres modelos en orden cuando están habilitados", async () => {
    const d = deps(fetch, {
      config: { enabled: true, serviceUrl: "http://127.0.0.1:8001", token: "ab".repeat(32), identityKey: null, realData: false, demo: true, mode: "demo", timeoutMs: 1000, allowedUserIds: null },
      openai: readOpenAiConfig({ OPENAI_API_KEY: OPENAI_KEY }),
    });
    const result = await handleStatus(d);
    expect((result.body.modelos as { id: string }[]).map((m) => m.id)).toEqual(["modelo-r", "gpt-luna", "gemini"]);
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

  it("GPT Luna sin clave → 404 sin llamar a OpenAI", async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), Response.json({}))) as typeof fetch;
    expect((await handleQuery(JSON.stringify({ mensaje: "Hola", modelo: "gpt-luna" }), deps(fetchFn))).status).toBe(404);
    expect(called).toBe(false);
  });
});

describe("catálogo del selector", () => {
  it("el estado incluye los tres modelos y marca cuáles están disponibles", async () => {
    const result = await handleStatus(deps(fetch));
    expect(result.body.catalogo).toEqual([
      expect.objectContaining({ id: "modelo-r", disponible: false }),
      expect.objectContaining({ id: "gpt-luna", disponible: false }),
      expect.objectContaining({ id: "gemini", disponible: true }),
    ]);
  });
});
