/**
 * Conexión con GPT Luna / OpenAI (SOLO servidor). Lo único que hay que configurar es la clave:
 *
 * - `OPENAI_API_KEY`: clave de la API de OpenAI. Sin ella, GPT Luna no aparece.
 * - `OPENAI_MODEL` (opcional): identificador del modelo; por defecto `gpt-6-luna`
 *   (el mismo valor por defecto que usa `ai-service`).
 *
 * La clave solo viaja del servidor a OpenAI en la cabecera `Authorization`; nunca llega al navegador.
 * GPT Luna no tiene acceso a la base de datos del ERP: solo recibe lo que el usuario escribe.
 */
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";
const ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 55_000;

export type OpenAiConfig = { enabled: true; apiKey: string; model: string } | { enabled: false };

export function readOpenAiConfig(env: Record<string, string | undefined> = process.env): OpenAiConfig {
  const apiKey = env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) return { enabled: false };
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  if (!/^[a-z0-9][a-z0-9._-]{0,60}$/i.test(model)) return { enabled: false };
  return { enabled: true, apiKey, model };
}

const INSTRUCTIONS =
  "Eres el asistente del ERP de una pollería. Responde en español, con claridad y brevedad, a preguntas " +
  "generales de contabilidad, gestión y operación de restaurantes. No tienes acceso a los datos del ERP: " +
  "si te piden saldos, cifras o movimientos concretos, indica que para eso deben usar el Modelo R.";

export type OpenAiResult = { ok: true; texto: string } | { ok: false; reason: "timeout" | "unavailable" | "rejected" };

/** Envía la conversación (turnos del usuario + mensaje actual) a OpenAI y devuelve el texto. */
export async function askOpenAi(
  config: Extract<OpenAiConfig, { enabled: true }>,
  historial: readonly string[],
  mensaje: string,
  fetchFn: typeof fetch = fetch,
): Promise<OpenAiResult> {
  const input = [...historial, mensaje].map((texto) => ({ role: "user", content: texto }));
  let response: Response;
  try {
    response = await fetchFn(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, instructions: INSTRUCTIONS, input, max_output_tokens: 1024, store: false }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
  } catch (exc) {
    const name = exc instanceof Error ? exc.name : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable" };
  }
  if (response.status === 400 || response.status === 401 || response.status === 403) return { ok: false, reason: "rejected" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    const data = (await response.json()) as { output?: { type?: unknown; content?: { type?: unknown; text?: unknown }[] }[] };
    const texto = (data.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .map((part) => (part.type === "output_text" && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    return texto ? { ok: true, texto: texto.slice(0, 4000) } : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
