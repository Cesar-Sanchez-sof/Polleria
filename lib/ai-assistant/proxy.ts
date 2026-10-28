/**
 * Proxy del asistente financiero: navegador → Next.js (servidor) → `ai-service` (`POST /v1/queries`).
 *
 * Controles (GET y POST):
 * - Asistente habilitado solo en modo demostración local o en evaluación sobre un Preview de Vercel
 *   (ver `config.ts`); el tiempo de espera hacia `ai-service` lo fija ese modo.
 * - Sesión del ERP validada en el servidor (`sesionActual`); el rol del asistente se deriva de la
 *   sesión y nunca del navegador. Roles no permitidos → 403. En evaluación, además, solo las cuentas
 *   de `AI_ASSISTANT_EVAL_USER_IDS` (otras cuentas del mismo rol → 403).
 * - El navegador solo puede enviar `mensaje`, `historial` y `ruta`; cualquier otra clave → 400.
 * - Al servicio solo se reenvían los turnos del usuario (las respuestas previas pueden contener
 *   importes y el servicio no los necesita).
 * - El token interno solo viaja en la cabecera hacia `ai-service`; nunca se devuelve ni se registra.
 * - P-9: con `AI_ASSISTANT_IDENTITY_KEY`, cada solicitud lleva una aserción HS256 firmada con la
 *   identidad de `sesionActual()` y el rol derivado en el servidor (`X-ERP-Identity`).
 * - Respuestas validadas contra el contrato; al navegador solo llega `AssistantReply`.
 * - Errores con mensajes sencillos, sin detalles internos.
 */
import type { SessionPayload } from "@/lib/auth/session";
import { assistantRoleFor, DEMO_SUGGESTIONS, type AssistantConfig } from "@/lib/ai-assistant/config";
import {
  AUTHORIZED_ROUTES,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  parseAgentResponse,
  parseQueryResponse,
  type AuthorizedRoute,
  type QueryRequest,
} from "@/lib/ai-assistant/contract";
import { IDENTITY_HEADER, signIdentity } from "@/lib/ai-assistant/identity";
import { MESSAGES, toAssistantReply } from "@/lib/ai-assistant/presentation";
import { askGemini, type GeminiConfig } from "@/lib/ai-assistant/gemini";
import { askOpenAi, type OpenAiConfig } from "@/lib/ai-assistant/openai";
import { ASSISTANT_MODELS, DEFAULT_MODEL, isModelId, MODEL_INFO, type AssistantModelId } from "@/lib/ai-assistant/models";

export const MAX_BODY_BYTES = 16 * 1024;
const TOKEN_HEADER = "X-Internal-Token";
const QUERY_PATH = "/v1/queries";
const AGENT_PATH = "/v1/agent/queries";

export interface ProxyDeps {
  config: AssistantConfig;
  session: () => Promise<SessionPayload | null>;
  fetchFn: typeof fetch;
  now: () => Date;
  newTraceId: () => string;
  /** Conexión opcional con Gemini (solo `GEMINI_API_KEY`). */
  gemini?: GeminiConfig;
  /** Conexión opcional con GPT Luna (solo `OPENAI_API_KEY`). */
  openai?: OpenAiConfig;
  /** Agente Gemini + ERP (`AI_GEMINI_SQL=1`): exige `ai-service` con identidad firmada (P-9). */
  geminiErp?: boolean;
  /** Modelo R disponible; por defecto sí. Con `AI_GEMINI_SQL=1` solo si se pide con `AI_MODEL_R=1`. */
  modelR?: boolean;
}

export interface ProxyResult {
  status: number;
  body: Record<string, unknown>;
}

const error = (status: number, message: string): ProxyResult => ({ status, body: { error: message } });

type Gate = { ok: true; session: SessionPayload; role: string } | { ok: false; result: ProxyResult };

/** Modelos habilitados por la configuración del servidor (en el orden del selector). */
function availableModels(deps: ProxyDeps): AssistantModelId[] {
  return ASSISTANT_MODELS.filter((id) => {
    if (id === "modelo-r") return deps.config.enabled && deps.modelR !== false;
    if (id === "gemini-erp") return deps.config.enabled && deps.config.identityKey !== null && deps.geminiErp === true;
    return id === "gpt-luna" ? deps.openai?.enabled === true : deps.gemini?.enabled === true;
  });
}

/**
 * `modelo`: el que se va a usar; `"cualquiera"` exige que haya uno disponible; `"estado"` solo valida
 * sesión y rol (el globo se muestra aunque no haya modelos, con el aviso de que no hay disponibles).
 */
async function gate(deps: ProxyDeps, modelo: AssistantModelId | "cualquiera" | "estado"): Promise<Gate> {
  const available =
    modelo === "estado"
      ? true
      : modelo === "cualquiera"
        ? availableModels(deps).length > 0
        : availableModels(deps).includes(modelo);
  if (!available) return { ok: false, result: error(404, MESSAGES.disabled) };
  const session = await deps.session().catch(() => null);
  if (!session) return { ok: false, result: error(401, MESSAGES.unauthorized) };
  const role = assistantRoleFor(session.role);
  if (!role) return { ok: false, result: error(403, MESSAGES.forbidden) };
  // Evaluación: solo las cuentas evaluadoras configuradas, aunque otros usuarios tengan el mismo rol.
  const allowed = deps.config.enabled ? deps.config.allowedUserIds : null;
  if (allowed !== null && !allowed.includes(session.userId)) return { ok: false, result: error(403, MESSAGES.forbidden) };
  return { ok: true, session, role };
}

/** GET: estado del asistente para el usuario actual (aplica los mismos controles que POST). */
export async function handleStatus(deps: ProxyDeps): Promise<ProxyResult> {
  const checked = await gate(deps, "estado");
  if (!checked.ok) return { status: checked.result.status, body: { enabled: false, ...checked.result.body } };
  const rOn = deps.config.enabled;
  const disponibles = availableModels(deps);
  const modelos = disponibles.map((id) => MODEL_INFO[id]);
  return {
    status: 200,
    body: {
      enabled: true,
      fakeData: deps.config.enabled ? !deps.config.realData : false,
      usuario: checked.session.userId,
      suggestions: rOn ? DEMO_SUGGESTIONS : [],
      modelos,
      catalogo: ASSISTANT_MODELS.map((id) => ({ ...MODEL_INFO[id], disponible: disponibles.includes(id) })),
      modeloPredeterminado: rOn ? DEFAULT_MODEL : (disponibles[0] ?? DEFAULT_MODEL),
    },
  };
}

/** Fecha de hoy en Lima (YYYY-MM-DD), calculada en el servidor (BR-10). */
export function limaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

interface BrowserInput {
  mensaje: string;
  historial: string[];
  ruta: AuthorizedRoute | null;
  modelo: AssistantModelId;
}

function parseBrowserInput(value: unknown): BrowserInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!Object.keys(input).every((key) => ["mensaje", "historial", "ruta", "modelo"].includes(key))) return null;
  const mensaje = typeof input.mensaje === "string" ? input.mensaje.trim() : "";
  if (!mensaje || mensaje.length > MAX_MESSAGE_CHARS) return null;

  const historial: string[] = [];
  if (input.historial !== undefined) {
    if (!Array.isArray(input.historial) || input.historial.length > 50) return null;
    for (const turn of input.historial) {
      if (typeof turn !== "object" || turn === null) return null;
      const { rol, texto } = turn as Record<string, unknown>;
      if ((rol !== "usuario" && rol !== "asistente") || typeof texto !== "string" || texto.length > 4000) return null;
      if (rol === "usuario" && texto.trim()) historial.push(texto.trim().slice(0, MAX_MESSAGE_CHARS));
    }
  }
  let ruta: AuthorizedRoute | null = null;
  if (input.ruta !== undefined && input.ruta !== null) {
    if (typeof input.ruta !== "string" || input.ruta.length > 200) return null;
    ruta = (AUTHORIZED_ROUTES as readonly string[]).includes(input.ruta) ? (input.ruta as AuthorizedRoute) : null;
  }
  if (input.modelo !== undefined && !isModelId(input.modelo)) return null;
  const modelo = input.modelo ?? DEFAULT_MODEL;
  return { mensaje, historial: historial.slice(-MAX_HISTORY_TURNS), ruta, modelo };
}

/** POST: pregunta del usuario → `ai-service` → respuesta sencilla y validada. */
export async function handleQuery(rawBody: string, deps: ProxyDeps): Promise<ProxyResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = undefined;
  }
  // El modelo se lee antes de la puerta de acceso para saber cuál debe estar habilitado.
  const requested = (parsed as { modelo?: unknown } | null | undefined)?.modelo;
  const checked = await gate(deps, isModelId(requested) ? requested : DEFAULT_MODEL);
  if (!checked.ok) return checked.result;
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) return error(413, MESSAGES.invalid);

  const input = parseBrowserInput(parsed);
  if (!input) return error(400, MESSAGES.invalid);

  if (input.modelo === "gemini" || input.modelo === "gpt-luna") {
    const result =
      input.modelo === "gemini"
        ? deps.gemini?.enabled === true
          ? await askGemini(deps.gemini, input.historial, input.mensaje, deps.fetchFn)
          : null
        : deps.openai?.enabled === true
          ? await askOpenAi(deps.openai, input.historial, input.mensaje, deps.fetchFn)
          : null;
    if (!result) return error(404, MESSAGES.disabled);
    if (result.ok) {
      return { status: 200, body: { id_traza: deps.newTraceId(), estado: "respondida", texto: result.texto, detalle: null } };
    }
    return result.reason === "timeout" ? error(504, MESSAGES.timeout) : error(503, MESSAGES.unavailable);
  }
  if (!deps.config.enabled) return error(404, MESSAGES.disabled);
  const config = deps.config;
  const useAgent = input.modelo === "gemini-erp";
  if (useAgent && !availableModels(deps).includes("gemini-erp")) return error(404, MESSAGES.disabled);

  const payload: QueryRequest = {
    id_traza: deps.newTraceId(),
    usuario: { id: checked.session.userId, rol: checked.role },
    mensaje: input.mensaje,
    contexto: input.ruta ? { ruta: input.ruta, filtros: {} } : null,
    historial: input.historial.map((texto) => ({ rol: "usuario" as const, texto })),
    fecha_referencia_lima: limaDate(deps.now()),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json", [TOKEN_HEADER]: config.token };
  if (config.identityKey) {
    // P-9: identidad firmada a partir de la sesión del servidor; el navegador no interviene.
    headers[IDENTITY_HEADER] = await signIdentity(
      config.identityKey,
      { userId: checked.session.userId, rol: checked.role, traceId: payload.id_traza },
      deps.now(),
    );
  }

  let response: Response;
  try {
    response = await deps.fetchFn(`${config.serviceUrl}${useAgent ? AGENT_PATH : QUERY_PATH}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (exc) {
    const name = exc instanceof Error ? exc.name : "";
    return name === "TimeoutError" || name === "AbortError" ? error(504, MESSAGES.timeout) : error(503, MESSAGES.unavailable);
  }

  if (response.status === 429) return error(429, MESSAGES.rateLimited);
  if (response.status === 403) return error(403, MESSAGES.forbidden);
  if (response.status === 400 || response.status === 413) return error(400, MESSAGES.invalid);
  if (response.status !== 200) return error(503, MESSAGES.unavailable);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return error(502, MESSAGES.unavailable);
  }
  if (useAgent) {
    const agentReply = parseAgentResponse(data);
    if (!agentReply || agentReply.id_traza !== payload.id_traza) return error(502, MESSAGES.unavailable);
    return { status: 200, body: { ...agentReply, detalle: null } };
  }
  const validated = parseQueryResponse(data);
  if (!validated || validated.id_traza !== payload.id_traza) return error(502, MESSAGES.unavailable);
  try {
    return { status: 200, body: { ...toAssistantReply(validated) } };
  } catch {
    return error(502, MESSAGES.unavailable);
  }
}
