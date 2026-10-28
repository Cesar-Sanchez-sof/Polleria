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
 * - Errores con mensajes sencillos, sin detalles internos, pero identificables: un `503` de
 *   `ai-service` dice qué componente falló (`codigo` de una lista cerrada) y un `401` de `ai-service`
 *   (credencial interna o identidad rechazadas) se informa como error de configuración.
 * - Modo diagnóstico (`config.diagnostics`): pide la traza técnica (`X-ERP-Diagnostics: 1`) y la
 *   reenvía validada; sin ese modo, una traza recibida se descarta.
 */
import type { SessionPayload } from "@/lib/auth/session";
import { assistantRoleFor, DEMO_SUGGESTIONS, REAL_DATA_SUGGESTIONS, type AssistantConfig } from "@/lib/ai-assistant/config";
import {
  AUTHORIZED_ROUTES,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  parseDiagnostic,
  parseQueryResponse,
  type AuthorizedRoute,
  type QueryRequest,
} from "@/lib/ai-assistant/contract";
import { IDENTITY_HEADER, signIdentity } from "@/lib/ai-assistant/identity";
import { allowedModules, type ModuleAccess } from "@/lib/ai-assistant/modules";
import { COMPONENT_MESSAGES, componentCode, MESSAGES, SERVICE_AUTH_CODE, toAssistantReply } from "@/lib/ai-assistant/presentation";

export const MAX_BODY_BYTES = 16 * 1024;
const TOKEN_HEADER = "X-Internal-Token";
export const DIAGNOSTICS_HEADER = "X-ERP-Diagnostics";

export interface ProxyDeps {
  config: AssistantConfig;
  session: () => Promise<SessionPayload | null>;
  fetchFn: typeof fetch;
  now: () => Date;
  newTraceId: () => string;
  /** Permisos vigentes del usuario (BD); con ellos se firman los módulos consultables (`mod`). */
  permissions?: (userId: number) => Promise<ModuleAccess>;
}

export interface ProxyResult {
  status: number;
  body: Record<string, unknown>;
}

const error = (status: number, message: string): ProxyResult => ({ status, body: { error: message } });

type Gate = { ok: true; session: SessionPayload; role: string; config: Extract<AssistantConfig, { enabled: true }> } | { ok: false; result: ProxyResult };

async function gate(deps: ProxyDeps): Promise<Gate> {
  if (!deps.config.enabled) return { ok: false, result: error(404, MESSAGES.disabled) };
  const session = await deps.session().catch(() => null);
  if (!session) return { ok: false, result: error(401, MESSAGES.unauthorized) };
  const role = assistantRoleFor(session.role);
  if (!role) return { ok: false, result: error(403, MESSAGES.forbidden) };
  // Evaluación: solo las cuentas evaluadoras configuradas, aunque otros usuarios tengan el mismo rol.
  const allowed = deps.config.allowedUserIds;
  if (allowed !== null && !allowed.includes(session.userId)) return { ok: false, result: error(403, MESSAGES.forbidden) };
  return { ok: true, session, role, config: deps.config };
}

/** GET: estado del asistente para el usuario actual (aplica los mismos controles que POST). */
export async function handleStatus(deps: ProxyDeps): Promise<ProxyResult> {
  const checked = await gate(deps);
  if (!checked.ok) return { status: checked.result.status, body: { enabled: false, ...checked.result.body } };
  return {
    status: 200,
    body: {
      enabled: true,
      fakeData: !checked.config.realData,
      usuario: checked.session.userId,
      suggestions: checked.config.realData ? REAL_DATA_SUGGESTIONS : DEMO_SUGGESTIONS,
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
    usuario: { id: checked.session.userId, rol: checked.role },
    mensaje: input.mensaje,
    contexto: input.ruta ? { ruta: input.ruta, filtros: {} } : null,
    historial: input.historial.map((texto) => ({ rol: "usuario" as const, texto })),
    fecha_referencia_lima: limaDate(deps.now()),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json", [TOKEN_HEADER]: checked.config.token };
  if (checked.config.diagnostics) headers[DIAGNOSTICS_HEADER] = "1";
  if (checked.config.identityKey) {
    // P-9: identidad firmada a partir de la sesión del servidor; el navegador no interviene.
    // Módulos del ERP según los permisos reales del usuario: ai-service no lee tablas de otros módulos.
    const access = deps.permissions ? await deps.permissions(checked.session.userId).catch(() => null) : undefined;
    if (access === null) return error(503, MESSAGES.unavailable); // sin permisos verificables no se consulta
    headers[IDENTITY_HEADER] = await signIdentity(
      checked.config.identityKey,
      {
        userId: checked.session.userId, rol: checked.role, traceId: payload.id_traza,
        ...(access ? { modulos: allowedModules(access) } : {}),
      },
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
  // 401 de ai-service = token interno o identidad firmada rechazados: error de configuración, no
  // sesión vencida del usuario (por eso 502 y no 401, que el widget interpreta como cierre de sesión).
  if (response.status === 401) return { status: 502, body: { error: MESSAGES.serviceAuth, codigo: SERVICE_AUTH_CODE } };
  if (response.status === 503) return await serviceError(response, checked.config.diagnostics === true);
  if (response.status !== 200) return error(503, MESSAGES.unavailable);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return error(502, MESSAGES.unavailable);
  }
  const validated = parseQueryResponse(data);
  if (!validated || validated.id_traza !== payload.id_traza) return error(502, MESSAGES.unavailable);
  if (!checked.config.diagnostics) delete validated.diagnostico; // solo si este despliegue la pidió
  try {
    return { status: 200, body: { ...toAssistantReply(validated) } };
  } catch {
    return error(502, MESSAGES.unavailable);
  }
}

/** `503` de ai-service: mensaje del componente que falló (código de una lista cerrada) y, en modo diagnóstico, la traza. */
async function serviceError(response: Response, diagnostics: boolean): Promise<ProxyResult> {
  const data: unknown = await response.json().catch(() => null);
  const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const code = componentCode(body.errores);
  const result: Record<string, unknown> = { error: code ? COMPONENT_MESSAGES[code] : MESSAGES.unavailable };
  if (code) result.codigo = code;
  if (diagnostics && body.diagnostico !== undefined) {
    const trace = parseDiagnostic(body.diagnostico);
    if (trace) result.diagnostico = trace;
  }
  return { status: 503, body: result };
}
