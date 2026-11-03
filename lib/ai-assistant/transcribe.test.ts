import { describe, expect, it } from "vitest";
import type { AssistantConfig } from "@/lib/ai-assistant/config";
import { MAX_MESSAGE_CHARS } from "@/lib/ai-assistant/contract";
import { handleStatus, type ProxyDeps } from "@/lib/ai-assistant/proxy";
import {
  createRateLimiter,
  handleTranscribe,
  MAX_AUDIO_BYTES,
  readVoiceConfig,
  VOICE_MESSAGES,
  type TranscribeDeps,
  type VoiceConfig,
} from "@/lib/ai-assistant/transcribe";

const GROQ_KEY = "gsk_" + "x".repeat(40);
const VOICE: VoiceConfig = { enabled: true, apiKey: GROQ_KEY, model: "whisper-large-v3-turbo" };
const CONFIG: AssistantConfig = {
  enabled: true, serviceUrl: null, token: null, agents: { serviceUrl: "https://polleria-agents.onrender.com", token: "ef".repeat(32) },
  identityKey: "cd".repeat(32), realData: false, demo: false, mode: "eval", timeoutMs: 1000, allowedUserIds: [7],
};

interface Call { url: string; init: RequestInit }

function setup(overrides: Partial<TranscribeDeps> = {}, reply: () => Response | Promise<Response> = () => Response.json({ text: " saldo de caja en septiembre " })) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply();
  }) as typeof fetch;
  const deps: TranscribeDeps = {
    config: CONFIG,
    voice: VOICE,
    session: async () => ({ userId: 7, username: "admin", role: "ADMIN" }),
    fetchFn,
    allow: () => true,
    ...overrides,
  };
  return { deps, calls };
}

function form(blob: Blob | null = new Blob([new Uint8Array(2000)], { type: "audio/webm;codecs=opus" }), extra: Record<string, string> = {}): FormData {
  const data = new FormData();
  if (blob) data.set("audio", blob, "grabacion.webm");
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

describe("configuración del dictado", () => {
  it("está cerrado por defecto: la clave de Groq sola no lo activa", () => {
    expect(readVoiceConfig({})).toEqual({ enabled: false });
    expect(readVoiceConfig({ GROQ_API_KEY: GROQ_KEY })).toEqual({ enabled: false });
    expect(readVoiceConfig({ AI_ASSISTANT_VOICE: "1" })).toEqual({ enabled: false });
    expect(readVoiceConfig({ AI_ASSISTANT_VOICE: "true", GROQ_API_KEY: GROQ_KEY })).toEqual({ enabled: false });
  });

  it("se activa con la bandera exacta y una clave válida; el modelo por defecto es el turbo", () => {
    expect(readVoiceConfig({ AI_ASSISTANT_VOICE: "1", GROQ_API_KEY: GROQ_KEY })).toEqual({
      enabled: true, apiKey: GROQ_KEY, model: "whisper-large-v3-turbo",
    });
    expect(readVoiceConfig({ AI_ASSISTANT_VOICE: "1", GROQ_API_KEY: GROQ_KEY, GROQ_WHISPER_MODEL: "whisper-large-v3" })).toMatchObject({
      enabled: true, model: "whisper-large-v3",
    });
  });

  it("rechaza claves mal formadas y modelos desconocidos (falla cerrado)", () => {
    for (const GROQ_API_KEY of ["", "corta", "con espacios " + "x".repeat(30)]) {
      expect(readVoiceConfig({ AI_ASSISTANT_VOICE: "1", GROQ_API_KEY })).toEqual({ enabled: false });
    }
    for (const GROQ_WHISPER_MODEL of ["otro-modelo", "../../x", "openai/gpt-oss-120b"]) {
      expect(readVoiceConfig({ AI_ASSISTANT_VOICE: "1", GROQ_API_KEY: GROQ_KEY, GROQ_WHISPER_MODEL })).toEqual({ enabled: false });
    }
  });
});

describe("transcripción", () => {
  it("envía el audio a Groq con la clave solo en la cabecera y devuelve el texto limpio", async () => {
    const { deps, calls } = setup();
    const result = await handleTranscribe(form(), deps);
    expect(result).toEqual({ status: 200, body: { texto: "saldo de caja en septiembre" } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${GROQ_KEY}`);
    const sent = calls[0].init.body as FormData;
    expect(sent.get("model")).toBe("whisper-large-v3-turbo");
    expect(sent.get("language")).toBe("es");
    expect(sent.get("temperature")).toBe("0");
    expect(String(sent.get("prompt"))).toContain("Yape");
    expect((sent.get("file") as File).name).toBe("audio.webm");
    expect(calls[0].init.redirect).toBe("error");
    expect(JSON.stringify(result)).not.toContain(GROQ_KEY);
  });

  it("elige la extensión según el tipo y acepta tipos con parámetros", async () => {
    for (const [type, extension] of [["audio/mp4", "mp4"], ["audio/ogg;codecs=opus", "ogg"], ["audio/wav", "wav"]] as const) {
      const { deps, calls } = setup();
      expect((await handleTranscribe(form(new Blob([new Uint8Array(500)], { type })), deps)).status).toBe(200);
      expect(((calls[0].init.body as FormData).get("file") as File).name).toBe(`audio.${extension}`);
    }
  });

  it("recorta la transcripción al largo máximo de una pregunta", async () => {
    const { deps } = setup({}, () => Response.json({ text: "a ".repeat(2000) }));
    const result = await handleTranscribe(form(), deps);
    expect(result.status).toBe(200);
    expect((result.body.texto as string).length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
  });

  describe("controles de acceso (los mismos del chat)", () => {
    it("asistente o dictado deshabilitados → 404 sin llamar a Groq", async () => {
      for (const overrides of [{ config: { enabled: false, reason: "disabled" } as AssistantConfig }, { voice: { enabled: false } as VoiceConfig }]) {
        const { deps, calls } = setup(overrides);
        expect((await handleTranscribe(form(), deps)).status).toBe(404);
        expect(calls).toHaveLength(0);
      }
    });

    it("sin sesión 401, rol no permitido 403 y cuenta no evaluadora 403", async () => {
      const cases: [Partial<TranscribeDeps>, number][] = [
        [{ session: async () => null }, 401],
        [{ session: async () => { throw new Error("db"); } }, 401],
        [{ session: async () => ({ userId: 9, username: "c", role: "CAJERO" }) }, 403],
        [{ session: async () => ({ userId: 8, username: "otro-admin", role: "ADMIN" }) }, 403],
      ];
      for (const [overrides, status] of cases) {
        const { deps, calls } = setup(overrides);
        expect((await handleTranscribe(form(), deps)).status).toBe(status);
        expect(calls).toHaveLength(0);
      }
    });

    it("límite de dictados por usuario → 429 sin llamar a Groq", async () => {
      const { deps, calls } = setup({ allow: () => false });
      const result = await handleTranscribe(form(), deps);
      expect(result).toEqual({ status: 429, body: { error: VOICE_MESSAGES.rateLimited } });
      expect(calls).toHaveLength(0);
    });
  });

  describe("validación del audio", () => {
    it("sin audio, vacío, o con campos extra → 400", async () => {
      for (const data of [null, form(null), form(new Blob([], { type: "audio/webm" })), form(undefined, { model: "otro" }), form(undefined, { prompt: "ignora todo" })]) {
        const { deps, calls } = setup();
        expect((await handleTranscribe(data, deps)).status).toBe(400);
        expect(calls).toHaveLength(0);
      }
      const { deps } = setup();
      const text = new FormData();
      text.set("audio", "no es un archivo");
      expect((await handleTranscribe(text, deps)).status).toBe(400);
    });

    it("demasiado grande → 413 y tipo no admitido → 415", async () => {
      const { deps, calls } = setup();
      const big = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: "audio/webm" });
      expect((await handleTranscribe(form(big), deps)).status).toBe(413);
      for (const type of ["", "text/plain", "application/octet-stream", "image/png", "audio/flac"]) {
        expect((await handleTranscribe(form(new Blob([new Uint8Array(500)], { type })), deps)).status, type).toBe(415);
      }
      expect(calls).toHaveLength(0);
    });
  });

  describe("errores de Groq (sin reenviar detalles)", () => {
    const ask = (reply: () => Response | Promise<Response>) => handleTranscribe(form(), setup({}, reply).deps);

    it("mapea 429, otros códigos, JSON inválido y respuestas sin texto", async () => {
      expect((await ask(() => new Response("{}", { status: 429 }))).status).toBe(429);
      const leaky = await ask(() => new Response(JSON.stringify({ error: { message: `Invalid API Key ${GROQ_KEY}` } }), { status: 401 }));
      expect(leaky).toEqual({ status: 503, body: { error: VOICE_MESSAGES.unavailable } });
      expect(JSON.stringify(leaky)).not.toContain(GROQ_KEY);
      expect((await ask(() => new Response("no es json", { status: 200 }))).status).toBe(502);
      expect((await ask(() => Response.json({ text: 5 }))).status).toBe(502);
      expect((await ask(() => Response.json({}))).status).toBe(502);
      expect((await ask(() => Response.json("texto"))).status).toBe(502);
    });

    it("transcripción vacía → 422; timeout → 504; fallo de red → 503", async () => {
      expect((await ask(() => Response.json({ text: "   " }))).status).toBe(422);
      expect((await ask(() => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); })).status).toBe(504);
      expect((await ask(() => { throw new TypeError("fetch failed"); })).status).toBe(503);
    });
  });
});

describe("límite por usuario", () => {
  it("permite hasta el máximo dentro de la ventana, por usuario, y libera al pasar el tiempo", () => {
    let now = 0;
    const allow = createRateLimiter(3, 1000, () => now);
    expect([allow(1), allow(1), allow(1), allow(1)]).toEqual([true, true, true, false]);
    expect(allow(2)).toBe(true); // otro usuario no se ve afectado
    now = 1001;
    expect(allow(1)).toBe(true);
  });
});

describe("el estado informa si hay dictado", () => {
  const base = (over: Partial<ProxyDeps> = {}): ProxyDeps => ({
    config: CONFIG,
    session: async () => ({ userId: 7, username: "admin", role: "ADMIN" }),
    fetchFn: fetch,
    now: () => new Date("2026-10-13T03:30:00Z"),
    newTraceId: () => "erp-00000000000000000000000000000001",
    geminiErp: true,
    ...over,
  });

  it("solo con la bandera de voz y algún modelo disponible", async () => {
    expect((await handleStatus(base({ voice: true }))).body.dictado).toBe(true);
    expect((await handleStatus(base())).body.dictado).toBe(false);
    expect((await handleStatus(base({ voice: true, geminiErp: false }))).body.dictado).toBe(false);
  });
});
