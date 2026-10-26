/**
 * Conexión con Gemini (SOLO servidor). Lo único que hay que configurar es la clave:
 *
 * - `GEMINI_API_KEY`: clave de la API de Gemini (Google AI Studio). Sin ella, Gemini no aparece.
 * - `GEMINI_MODEL` (opcional): identificador del modelo; por defecto `gemini-3.5-flash`.
 *
 * La clave solo viaja del servidor a Google en la cabecera `x-goog-api-key`; nunca llega al navegador.
 * Gemini no tiene acceso a la base de datos del ERP: solo recibe lo que el usuario escribe.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 55_000;

export type GeminiConfig = { enabled: true; apiKey: string; model: string } | { enabled: false };

export function readGeminiConfig(env: Record<string, string | undefined> = process.env): GeminiConfig {
  const apiKey = env.GEMINI_API_KEY?.trim() ?? "";
  if (!apiKey) return { enabled: false };
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!/^[a-z0-9][a-z0-9._-]{0,60}$/i.test(model)) return { enabled: false };
  return { enabled: true, apiKey, model };
}

const SYSTEM_PROMPT =
  "Eres el asistente del ERP de una pollería. Responde en español, con claridad y brevedad, a preguntas " +
  "generales de contabilidad, gestión y operación de restaurantes. No tienes acceso a los datos del ERP: " +
  "si te piden saldos, cifras o movimientos concretos, indica que para eso deben usar el Modelo R.";

export type GeminiResult = { ok: true; texto: string } | { ok: false; reason: "timeout" | "unavailable" | "rejected" };

/** Envía la conversación (turnos del usuario + mensaje actual) a Gemini y devuelve el texto. */
export async function askGemini(
  config: Extract<GeminiConfig, { enabled: true }>,
  historial: readonly string[],
  mensaje: string,
  fetchFn: typeof fetch = fetch,
): Promise<GeminiResult> {
  const contents = [...historial, mensaje].map((texto) => ({ role: "user", parts: [{ text: texto }] }));
  let response: Response;
  try {
    response = await fetchFn(`${ENDPOINT}/${encodeURIComponent(config.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (exc) {
    const name = exc instanceof Error ? exc.name : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable" };
  }
  if (response.status === 400 || response.status === 401 || response.status === 403) return { ok: false, reason: "rejected" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    const texto = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    return texto ? { ok: true, texto: texto.slice(0, 4000) } : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
