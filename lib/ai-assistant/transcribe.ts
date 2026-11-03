/**
 * Dictado por voz del asistente (SOLO servidor): navegador → Next.js (`/api/assistant/transcribe`) → Whisper en Groq.
 *
 * Variables privadas (sin prefijo `NEXT_PUBLIC_`, nunca llegan al navegador):
 * - `AI_ASSISTANT_VOICE`: exactamente `1` para activar el dictado. Cerrado por defecto: tener `GROQ_API_KEY`
 *   (que también usa el agente de Groq) no basta, porque el audio sale a un tercero.
 * - `GROQ_API_KEY`: clave de la API de Groq (la misma del agente Groq de `agents-service`).
 * - `GROQ_WHISPER_MODEL` (opcional): `whisper-large-v3-turbo` (por defecto) o `whisper-large-v3`.
 *
 * Controles (los mismos del chat, vía `authorizeAssistant`): sesión del ERP, rol permitido, asistente habilitado
 * y, en evaluación, solo las cuentas de `AI_ASSISTANT_EVAL_USER_IDS`. Además: tipo y tamaño del audio, y un
 * límite de dictados por usuario.
 *
 * El audio no se guarda ni se registra: solo se reenvía a Groq y se descarta. La transcripción vuelve al
 * navegador como texto para que el usuario la revise; nunca se envía sola al asistente (Whisper puede
 * equivocarse con cifras y nombres). La clave nunca se devuelve y los errores de Groq no se reenvían.
 */
import type { SessionPayload } from "@/lib/auth/session";
import type { AssistantConfig } from "@/lib/ai-assistant/config";
import { MAX_MESSAGE_CHARS } from "@/lib/ai-assistant/contract";
import { authorizeAssistant, type ProxyResult } from "@/lib/ai-assistant/proxy";
import { MESSAGES } from "@/lib/ai-assistant/presentation";

export const DEFAULT_WHISPER_MODEL = "whisper-large-v3-turbo";
export const WHISPER_MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"] as const;
const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
/** Vercel admite ~4,5 MB por petición: el audio queda por debajo, con margen para el resto del formulario. */
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
/** Cuerpo máximo de la petición (audio + campos del formulario). */
export const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
export const TRANSCRIBE_TIMEOUT_MS = 25_000;
/** Dictados por usuario y minuto (Groq admite 20 por minuto en total). */
export const VOICE_RATE_LIMIT = { max: 10, windowMs: 60_000 } as const;
/** Vocabulario del dominio: orienta a Whisper con términos que suele confundir. */
const VOCABULARY =
  "Pollería. Saldo de caja, bancos, proveedores, ventas, compras, cobros, Yape, Plin, boletas, facturas, IGV, " +
  "plan de cuentas, libro diario, libro mayor, asientos contables, cuenta 101.";

export type VoiceConfig = { enabled: true; apiKey: string; model: string } | { enabled: false };

const KEY_RE = /^[A-Za-z0-9_-]{20,200}$/;

export function readVoiceConfig(env: Record<string, string | undefined> = process.env): VoiceConfig {
  if (env.AI_ASSISTANT_VOICE !== "1") return { enabled: false };
  const apiKey = env.GROQ_API_KEY?.trim() ?? "";
  if (!KEY_RE.test(apiKey)) return { enabled: false };
  const model = env.GROQ_WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL;
  if (!(WHISPER_MODELS as readonly string[]).includes(model)) return { enabled: false };
  return { enabled: true, apiKey, model };
}

/** Tipo base (sin parámetros como `;codecs=opus`) → extensión que Whisper reconoce. */
const AUDIO_TYPES: Readonly<Record<string, string>> = Object.freeze({
  "audio/webm": "webm",
  "video/webm": "webm", // algunos navegadores etiquetan así una grabación solo de audio
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
});

export const VOICE_MESSAGES = {
  invalid: "No pude procesar el audio. Graba de nuevo, en pocas palabras.",
  tooLarge: "El audio es demasiado largo. Graba un mensaje más corto.",
  unsupported: "El formato de audio no es compatible con este navegador.",
  empty: "No logré entender el audio. Habla más cerca del micrófono e inténtalo de nuevo.",
  rateLimited: "Dictaste muchas veces seguidas. Espera un minuto e inténtalo de nuevo.",
  timeout: "La transcripción tardó demasiado. Intenta de nuevo.",
  unavailable: "El dictado no está disponible en este momento. Escribe tu pregunta.",
} as const;

const failure = (status: number, message: string): ProxyResult => ({ status, body: { error: message } });

/** Límite por usuario en memoria (ventana deslizante); por instancia del servidor, así que es un tope aproximado. */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<number, number[]>();
  return (userId: number): boolean => {
    const t = now();
    const recent = (hits.get(userId) ?? []).filter((at) => t - at < windowMs);
    if (recent.length >= max) {
      hits.set(userId, recent);
      return false;
    }
    recent.push(t);
    hits.set(userId, recent);
    if (hits.size > 1000) for (const [id, list] of hits) if (list.every((at) => t - at >= windowMs)) hits.delete(id);
    return true;
  };
}

export interface TranscribeDeps {
  config: AssistantConfig;
  voice: VoiceConfig;
  session: () => Promise<SessionPayload | null>;
  fetchFn: typeof fetch;
  allow: (userId: number) => boolean;
}

/** POST: audio grabado → texto (`{ texto }`). El texto vuelve al navegador; no se envía al asistente. */
export async function handleTranscribe(form: FormData | null, deps: TranscribeDeps): Promise<ProxyResult> {
  if (!deps.config.enabled || !deps.voice.enabled) return failure(404, MESSAGES.disabled);
  const checked = await authorizeAssistant(deps.config, deps.session);
  if (!checked.ok) return checked.result;
  const voice = deps.voice;

  const audio = form?.get("audio");
  if (!form || !(audio instanceof Blob) || audio.size === 0) return failure(400, VOICE_MESSAGES.invalid);
  if ([...form.keys()].some((key) => key !== "audio")) return failure(400, VOICE_MESSAGES.invalid);
  if (audio.size > MAX_AUDIO_BYTES) return failure(413, VOICE_MESSAGES.tooLarge);
  const extension = AUDIO_TYPES[audio.type.split(";")[0].trim().toLowerCase()];
  if (!extension) return failure(415, VOICE_MESSAGES.unsupported);
  if (!deps.allow(checked.session.userId)) return failure(429, VOICE_MESSAGES.rateLimited);

  const body = new FormData();
  body.set("file", new File([audio], `audio.${extension}`, { type: audio.type }));
  body.set("model", voice.model);
  body.set("language", "es");
  body.set("temperature", "0");
  body.set("response_format", "json");
  body.set("prompt", VOCABULARY);

  let response: Response;
  try {
    response = await deps.fetchFn(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${voice.apiKey}` },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
  } catch (exc) {
    const name = exc instanceof Error ? exc.name : "";
    return name === "TimeoutError" || name === "AbortError" ? failure(504, VOICE_MESSAGES.timeout) : failure(503, VOICE_MESSAGES.unavailable);
  }
  if (response.status === 429) return failure(429, VOICE_MESSAGES.rateLimited);
  if (response.status !== 200) return failure(503, VOICE_MESSAGES.unavailable); // sin reenviar el detalle de Groq

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return failure(502, VOICE_MESSAGES.unavailable);
  }
  const text = typeof data === "object" && data !== null ? (data as { text?: unknown }).text : undefined;
  if (typeof text !== "string") return failure(502, VOICE_MESSAGES.unavailable);
  const texto = text.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!texto) return failure(422, VOICE_MESSAGES.empty);
  return { status: 200, body: { texto } };
}
