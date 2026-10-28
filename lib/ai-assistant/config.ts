/**
 * Configuración del asistente financiero (SOLO servidor; nunca importar desde componentes cliente).
 *
 * Variables privadas (sin prefijo `NEXT_PUBLIC_`, nunca llegan al navegador):
 * - `AI_ASSISTANT_DEMO`: debe ser exactamente `1` para activar el modo demostración.
 * - `AI_SERVICE_URL`: exactamente `http://127.0.0.1:<puerto>` (servicio de IA local).
 * - `AI_SERVICE_INTERNAL_TOKEN`: token del proxy hacia `ai-service` (hex de 32 bytes o más).
 *
 * - `AI_ASSISTANT_IDENTITY_KEY` (P-9): clave HS256 compartida con `ai-service` para firmar la
 *   identidad de cada solicitud (hex de 32 bytes o más, distinta del token interno).
 * - `AI_ASSISTANT_REAL_DATA`: `1` solo en pruebas locales controladas con datos reales; exige la
 *   clave de identidad. Por defecto el asistente usa datos ficticios.
 *
 * Agentes de solo lectura (Gemini y GPT OSS vía Groq): viven en `agents-service`, un despliegue aparte de
 * `ai-service` (que solo sirve al Modelo R). Cada servicio tiene su propia URL y su propio token, y ninguno
 * hace falta para el otro: basta con configurar uno de los dos.
 * - `AGENTS_SERVICE_URL`: `https://<servicio>.onrender.com` (sin puerto, ruta ni `/` final) o, solo en el modo
 *   demostración local, `http://127.0.0.1:<puerto>`.
 * - `AGENTS_SERVICE_INTERNAL_TOKEN`: token del proxy hacia `agents-service` (hex de 32 bytes o más, distinto
 *   de la clave de identidad). Exige `AI_ASSISTANT_IDENTITY_KEY`.
 *
 * Con `NODE_ENV=production` el modo demostración queda SIEMPRE deshabilitado. Ningún modo omite la
 * autenticación del ERP: exige sesión válida (`sesionActual()`) y un rol permitido.
 *
 * Modo evaluación académica (despliegue en Vercel):
 * - `AI_ASSISTANT_EVAL_ENABLED`: exactamente `1`. Surte efecto con `VERCEL_ENV=preview` (Vercel lo fija
 *   en cada despliegue). Con `VERCEL_ENV=production` exige ADEMÁS `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL=1`
 *   (habilitación temporal y explícita para la evaluación). En `development` o fuera de Vercel queda
 *   deshabilitado. `NODE_ENV` no sirve para distinguirlos: Preview y Production compilan con `production`.
 *   Ambas banderas son privadas del servidor (sin `NEXT_PUBLIC_`).
 * - `AI_SERVICE_URL` (Modelo R; opcional si hay `AGENTS_SERVICE_URL`): túnel HTTPS temporal hacia el FastAPI local, exactamente
 *   `https://<subdominio>.trycloudflare.com` (Cloudflare Quick Tunnel) o el dominio estático de ngrok
 *   del proyecto (`EVAL_NGROK_URL`); ningún otro dominio de ngrok. Sin puerto, ruta ni `/` final.
 *   `AI_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY` (P-9) son obligatorios.
 * - `AI_ASSISTANT_EVAL_USER_IDS`: ids del ERP (`sesionActual().idUsuario`) de las cuentas evaluadoras,
 *   separados por comas. Obligatorio en Production y con datos reales: solo esas cuentas ADMIN usan el
 *   asistente; los demás administradores reciben 403.
 * - Datos ficticios por defecto. `AI_ASSISTANT_REAL_DATA=1` (consulta real en solo lectura, decidida y
 *   aplicada por `ai-service` con `AI_SERVICE_EVAL_REAL_DATA=1`) solo es válido junto con
 *   `AI_ASSISTANT_EVAL_USER_IDS`; si falta, la configuración se invalida (falla cerrado).
 *
 * - `AI_ASSISTANT_DIAGNOSTICS`: `1` para pedir la traza técnica de cada consulta (etapas, modelo y
 *   adaptador que respondieron, SQL generado y validado, filas y tiempos). Exige la clave de identidad
 *   y, en evaluación, `AI_ASSISTANT_EVAL_USER_IDS`. Cerrado por defecto.
 */

export type AssistantMode = "demo" | "eval";

/** Destino y credencial del proxy hacia un servicio de IA. */
export interface ServiceConnection {
  serviceUrl: string;
  token: string;
}

export type AssistantConfig =
  | {
      enabled: true;
      /** Modelo R (`ai-service`); `null` si solo se configuraron los agentes. */
      serviceUrl: string | null;
      token: string | null;
      /** Agentes de solo lectura (`agents-service`); ausente o `null` si no se configuraron. */
      agents?: ServiceConnection | null;
      identityKey: string | null;
      realData: boolean;
      demo: boolean;
      mode: AssistantMode;
      timeoutMs: number;
      /** Evaluación: únicas cuentas del ERP autorizadas; `null` = cualquier usuario del rol permitido. */
      allowedUserIds: readonly number[] | null;
      /** Pide la traza técnica a `ai-service` (`AI_ASSISTANT_DIAGNOSTICS=1`; ver `diagnosticsEnabled`). */
      diagnostics?: boolean;
    }
  | { enabled: false; reason: "production" | "disabled" | "misconfigured" };

const URL_RE = /^http:\/\/127\.0\.0\.1:(\d{4,5})$/;
const EVAL_URL_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/;
/** Dominio estático de ngrok del proyecto: se compara de forma exacta, no por sufijo. */
export const EVAL_NGROK_URL = "https://charlott-unflagitious-unselfishly.ngrok-free.dev";
const isEvalTunnelUrl = (url: string) => EVAL_URL_RE.test(url) || url === EVAL_NGROK_URL;
/** `agents-service` desplegado en Render: `https://<servicio>.onrender.com`. */
const AGENTS_URL_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onrender\.com$/;
const TOKEN_RE = /^[0-9a-fA-F]{64,}$/;
const USER_IDS_RE = /^[1-9]\d{0,9}(,[1-9]\d{0,9}){0,9}$/;
/** Local: la primera inferencia de XiYanSQL puede tardar más. */
export const DEMO_TIMEOUT_MS = 120_000;
/** Vercel: por debajo de `maxDuration` (60 s) de `app/api/assistant/route.ts`. */
export const EVAL_TIMEOUT_MS = 55_000;

/**
 * Conexión opcional: sin URL no hay servicio (`null`); con URL, la URL y el token deben ser válidos
 * (`undefined` = configuración inválida, falla cerrado).
 */
function connection(url: string, token: string, urlOk: (url: string) => boolean): ServiceConnection | null | undefined {
  if (!url) return null;
  return urlOk(url) && TOKEN_RE.test(token) ? { serviceUrl: url, token } : undefined;
}

function localPortOk(url: string): boolean {
  const port = URL_RE.exec(url)?.[1];
  return !!port && Number(port) >= 1024 && Number(port) <= 65535;
}

/** `agents-service`: Render en ambos modos; el puerto local solo en la demostración. */
function agentsConnection(env: Record<string, string | undefined>, mode: AssistantMode): ServiceConnection | null | undefined {
  const urlOk = (url: string) => AGENTS_URL_RE.test(url) || (mode === "demo" && localPortOk(url));
  return connection(env.AGENTS_SERVICE_URL?.trim() ?? "", env.AGENTS_SERVICE_INTERNAL_TOKEN?.trim() ?? "", urlOk);
}

/** La clave de identidad (P-9) es independiente de los tokens de cada servicio configurado. */
function identityDistinct(identityKey: string, ...connections: (ServiceConnection | null)[]): boolean {
  return connections.every((c) => c === null || c.token.toLowerCase() !== identityKey.toLowerCase());
}

function readEvalConfig(env: Record<string, string | undefined>): AssistantConfig {
  // Preview de Vercel, o Production solo con la segunda bandera explícita (deshabilitado por defecto).
  const allowed =
    env.VERCEL_ENV === "preview" ||
    (env.VERCEL_ENV === "production" && env.AI_ASSISTANT_ALLOW_PRODUCTION_EVAL === "1");
  if (!allowed) return { enabled: false, reason: "production" };
  const identityKey = env.AI_ASSISTANT_IDENTITY_KEY?.trim() ?? "";
  const realData = env.AI_ASSISTANT_REAL_DATA === "1";
  const usersText = (env.AI_ASSISTANT_EVAL_USER_IDS ?? "").replace(/\s/g, "");
  if (usersText && !USER_IDS_RE.test(usersText)) return { enabled: false, reason: "misconfigured" };
  const allowedUserIds = usersText ? usersText.split(",").map(Number) : null;
  const modelR = connection(env.AI_SERVICE_URL?.trim() ?? "", env.AI_SERVICE_INTERNAL_TOKEN?.trim() ?? "", isEvalTunnelUrl);
  const agents = agentsConnection(env, "eval");
  if (
    modelR === undefined ||
    agents === undefined ||
    (modelR === null && agents === null) || // al menos un servicio de IA
    !TOKEN_RE.test(identityKey) ||
    !identityDistinct(identityKey, modelR, agents) ||
    // Production y datos reales: solo cuentas evaluadoras explícitas, nunca todos los ADMIN.
    ((env.VERCEL_ENV === "production" || realData) && allowedUserIds === null)
  ) {
    return { enabled: false, reason: "misconfigured" };
  }
  return {
    enabled: true, serviceUrl: modelR?.serviceUrl ?? null, token: modelR?.token ?? null, agents, identityKey, realData, demo: false,
    mode: "eval", timeoutMs: EVAL_TIMEOUT_MS, allowedUserIds,
    diagnostics: diagnosticsEnabled(env, identityKey, allowedUserIds),
  };
}

/**
 * Modo diagnóstico (traza técnica en cada respuesta): `AI_ASSISTANT_DIAGNOSTICS=1`, identidad firmada
 * (P-9) y, en evaluación, cuentas evaluadoras explícitas. `ai-service` exige además su propia bandera
 * (`AI_SERVICE_DIAGNOSTICS=1`) y verifica la identidad: los tres candados deben coincidir.
 */
function diagnosticsEnabled(
  env: Record<string, string | undefined>, identityKey: string | null, allowedUserIds: readonly number[] | null,
): boolean {
  if (env.AI_ASSISTANT_DIAGNOSTICS !== "1" || !identityKey) return false;
  return env.AI_ASSISTANT_EVAL_ENABLED !== "1" || allowedUserIds !== null;
}

export function readAssistantConfig(env: Record<string, string | undefined> = process.env): AssistantConfig {
  if (env.AI_ASSISTANT_EVAL_ENABLED === "1") return readEvalConfig(env);
  if (env.NODE_ENV === "production") return { enabled: false, reason: "production" };
  if (env.AI_ASSISTANT_DEMO !== "1") return { enabled: false, reason: "disabled" };
  const identityKey = env.AI_ASSISTANT_IDENTITY_KEY?.trim() || null;
  const realData = env.AI_ASSISTANT_REAL_DATA === "1";
  const modelR = connection(env.AI_SERVICE_URL?.trim() ?? "", env.AI_SERVICE_INTERNAL_TOKEN?.trim() ?? "", localPortOk);
  const agents = agentsConnection(env, "demo");
  if (modelR === undefined || agents === undefined || (modelR === null && agents === null)) {
    return { enabled: false, reason: "misconfigured" };
  }
  if (identityKey !== null && (!TOKEN_RE.test(identityKey) || !identityDistinct(identityKey, modelR, agents))) {
    return { enabled: false, reason: "misconfigured" };
  }
  if (realData && identityKey === null) return { enabled: false, reason: "misconfigured" }; // P-9 obligatorio
  if (agents !== null && identityKey === null) return { enabled: false, reason: "misconfigured" }; // los agentes exigen P-9
  return {
    enabled: true, serviceUrl: modelR?.serviceUrl ?? null, token: modelR?.token ?? null, agents, identityKey, realData, demo: true,
    mode: "demo", timeoutMs: DEMO_TIMEOUT_MS, allowedUserIds: null,
    diagnostics: diagnosticsEnabled(env, identityKey, null),
  };
}

/**
 * Equivalencia de roles del ERP → rol del asistente (demostración local y evaluación; solo ADMIN).
 * Se decide en el servidor a partir de la sesión; el navegador nunca envía un rol.
 */
const DEMO_ROLE_MAP: Readonly<Record<string, string>> = Object.freeze({ ADMIN: "contador_demo" });

export function assistantRoleFor(erpRole: string): string | null {
  return Object.prototype.hasOwnProperty.call(DEMO_ROLE_MAP, erpRole) ? DEMO_ROLE_MAP[erpRole] : null;
}

/** Preguntas que el backend puede responder con los datos ficticios de la demostración. */
export const DEMO_SUGGESTIONS: readonly string[] = [
  "¿Cuál fue el saldo de caja en septiembre?",
  "¿Cuál fue el saldo de bancos en septiembre?",
  "¿Cuál fue el saldo de proveedores en septiembre?",
  "¿Y el saldo de caja en agosto?",
];

/**
 * Ejemplos con datos reales (P1). Son solo atajos para escribir: siguen el mismo camino que cualquier
 * pregunta libre (intérprete → XiYanSQL → validador → base de datos) y no tienen respuesta asociada.
 */
export const REAL_DATA_SUGGESTIONS: readonly string[] = [
  "¿Cuánto vendimos este mes?",
  "¿Qué productos generan mayores ingresos este mes?",
  "¿Qué día tuvimos mayores ingresos este mes?",
  "¿Cuáles son los gastos más elevados este mes?",
];
