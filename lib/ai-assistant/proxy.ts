/**
 * Proxy del asistente financiero: navegador → Next.js (servidor) → `ai-service` (`POST /v1/queries`).
 *
 * Controles (GET y POST):
 * - Asistente habilitado solo en modo demostración local o en evaluación sobre un Preview de Vercel
 *   (ver `config.ts`); el tiempo de espera hacia `ai-service` lo fija ese modo.
 * - Sesión del ERP validada en el servidor (`sesionActual`); el rol del asistente se deriva de la
 *   sesión y nunca del navegador. Roles no permitidos → 403.
 * - El navegador solo puede enviar `mensaje`, `historial` y `ruta`; cualquier otra clave → 400.
 * - Al servicio solo se reenvían los turnos del usuario (las respuestas previas pueden contener
 *   importes y el servicio no los necesita).
 * - El token interno solo viaja en la cabecera hacia `ai-service`; nunca se devuelve ni se registra.
 * - P-9: con `AI_ASSISTANT_IDENTITY_KEY`, cada solicitud lleva una aserción HS256 firmada con la
 *   identidad de `sesionActual()` y el rol derivado en el servidor (`X-ERP-Identity`).
 * - Respuestas validadas contra el contrato; al navegador solo llega `AssistantReply`.
 * - Errores con mensajes sencillos, sin detalles internos.
 */
import type { PayloadSesion } from "@/lib/auth/session";
import { assistantRoleFor, DEMO_SUGGESTIONS, type AssistantConfig } from "@/lib/ai-assistant/config";
import {
  AUTHORIZED_ROUTES,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  parseQueryResponse,
  type AuthorizedRoute,
  type QueryRequest,
} from "@/lib/ai-assistant/contract";
import { IDENTITY_HEADER, signIdentity } from "@/lib/ai-assistant/identity";
import { MESSAGES, toAssistantReply } from "@/lib/ai-assistant/presentation";

export const MAX_BODY_BYTES = 16 * 1024;
const TOKEN_HEADER = "X-Internal-Token";

export interface ProxyDeps {
  config: AssistantConfig;
  session: () => Promise<PayloadSesion | null>;
  fetchFn: typeof fetch;
  now: () => Date;
  newTraceId: () => string;
}

export interface ProxyResult {
  status: number;
  body: Record<string, unknown>;
}

const error = (status: number, message: string): ProxyResult => ({ status, body: { error: message } });

type Gate = { ok: true; session: PayloadSesion; role: string; config: Extract<AssistantConfig, { enabled: true }> } | { ok: false; result: ProxyResult };

async function gate(deps: ProxyDeps): Promise<Gate> {
  if (!deps.config.enabled) return { ok: false, result: error(404, MESSAGES.disabled) };
  const session = await deps.session().catch(() => null);
  if (!session) return { ok: false, result: error(401, MESSAGES.unauthorized) };
  const role = assistantRoleFor(session.rol);
  if (!role) return { ok: false, result: error(403, MESSAGES.forbidden) };
  return { ok: true, session, role, config: deps.config };
}

/** GET: estado del asistente para el usuario actual (aplica los mismos controles que POST). */
export async function handleStatus(deps: ProxyDeps): Promise<ProxyResult> {
  const checked = await gate(deps);
  if (!checked.ok) return { status: checked.result.status, body: { habilitado: false, ...checked.result.body } };
  return {
    status: 200,
    body: {
      habilitado: true,
      datosFicticios: !checked.config.realData,
      usuario: checked.session.idUsuario,
      sugerencias: DEMO_SUGGESTIONS,
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
}

function parseBrowserInput(value: unknown): BrowserInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!Object.keys(input).every((key) => ["mensaje", "historial", "ruta"].includes(key))) return null;
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
  return { mensaje, historial: historial.slice(-MAX_HISTORY_TURNS), ruta };
}

/** POST: pregunta del usuario → `ai-service` → respuesta sencilla y validada. */
export async function handleQuery(rawBody: string, deps: ProxyDeps): Promise<ProxyResult> {
  const checked = await gate(deps);
  if (!checked.ok) return checked.result;
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) return error(413, MESSAGES.invalid);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return error(400, MESSAGES.invalid);
  }
  const input = parseBrowserInput(parsed);
  if (!input) return error(400, MESSAGES.invalid);

  const payload: QueryRequest = {
    id_traza: deps.newTraceId(),
    usuario: { id: checked.session.idUsuario, rol: checked.role },
    mensaje: input.mensaje,
    contexto: input.ruta ? { ruta: input.ruta, filtros: {} } : null,
    historial: input.historial.map((texto) => ({ rol: "usuario" as const, texto })),
    fecha_referencia_lima: limaDate(deps.now()),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json", [TOKEN_HEADER]: checked.config.token };
  if (checked.config.identityKey) {
    // P-9: identidad firmada a partir de la sesión del servidor; el navegador no interviene.
    headers[IDENTITY_HEADER] = await signIdentity(
      checked.config.identityKey,
      { userId: checked.session.idUsuario, rol: checked.role, traceId: payload.id_traza },
      deps.now(),
    );
  }

  let response: Response;
  try {
    response = await deps.fetchFn(`${checked.config.serviceUrl}/v1/queries`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(checked.config.timeoutMs),
    });
  } catch (exc) {
    const name = exc instanceof Error ? exc.name : "";
    return name === "TimeoutError" || name === "AbortError" ? error(504, MESSAGES.timeout) : error(503, MESSAGES.unavailable);
  }

  if (response.status === 403) return error(403, MESSAGES.forbidden);
  if (response.status === 400 || response.status === 413) return error(400, MESSAGES.invalid);
  if (response.status !== 200) return error(503, MESSAGES.unavailable);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return error(502, MESSAGES.unavailable);
  }
  const validated = parseQueryResponse(data);
  if (!validated || validated.id_traza !== payload.id_traza) return error(502, MESSAGES.unavailable);
  try {
    return { status: 200, body: { ...toAssistantReply(validated) } };
  } catch {
    return error(502, MESSAGES.unavailable);
  }
}
