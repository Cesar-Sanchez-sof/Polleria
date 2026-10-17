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
 * Con `NODE_ENV=production` el modo demostración queda SIEMPRE deshabilitado. Ningún modo omite la
 * autenticación del ERP: exige sesión válida (`sesionActual()`) y un rol permitido.
 *
 * Modo evaluación académica (despliegue en Vercel):
 * - `AI_ASSISTANT_EVAL_ENABLED`: exactamente `1`. Surte efecto con `VERCEL_ENV=preview` (Vercel lo fija
 *   en cada despliegue). Con `VERCEL_ENV=production` exige ADEMÁS `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL=1`
 *   (habilitación temporal y explícita para la evaluación). En `development` o fuera de Vercel queda
 *   deshabilitado. `NODE_ENV` no sirve para distinguirlos: Preview y Production compilan con `production`.
 *   Ambas banderas son privadas del servidor (sin `NEXT_PUBLIC_`).
 * - `AI_SERVICE_URL`: túnel HTTPS temporal hacia el FastAPI local, exactamente
 *   `https://<subdominio>.trycloudflare.com` (Cloudflare Quick Tunnel) o el dominio estático de ngrok
 *   del proyecto (`EVAL_NGROK_URL`); ningún otro dominio de ngrok. Sin puerto, ruta ni `/` final.
 *   `AI_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY` (P-9) son obligatorios.
 * - `AI_ASSISTANT_EVAL_USER_IDS`: ids del ERP (`sesionActual().idUsuario`) de las cuentas evaluadoras,
 *   separados por comas. Obligatorio en Production y con datos reales: solo esas cuentas ADMIN usan el
 *   asistente; los demás administradores reciben 403.
 * - Datos ficticios por defecto. `AI_ASSISTANT_REAL_DATA=1` (consulta real en solo lectura, decidida y
 *   aplicada por `ai-service` con `AI_SERVICE_EVAL_REAL_DATA=1`) solo es válido junto con
 *   `AI_ASSISTANT_EVAL_USER_IDS`; si falta, la configuración se invalida (falla cerrado).
 */

export type AssistantMode = "demo" | "eval";

export type AssistantConfig =
  | {
      enabled: true;
      serviceUrl: string;
      token: string;
      identityKey: string | null;
      realData: boolean;
      demo: boolean;
      mode: AssistantMode;
      timeoutMs: number;
      /** Evaluación: únicas cuentas del ERP autorizadas; `null` = cualquier usuario del rol permitido. */
      allowedUserIds: readonly number[] | null;
    }
  | { enabled: false; reason: "production" | "disabled" | "misconfigured" };

const URL_RE = /^http:\/\/127\.0\.0\.1:(\d{4,5})$/;
const EVAL_URL_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/;
/** Dominio estático de ngrok del proyecto: se compara de forma exacta, no por sufijo. */
export const EVAL_NGROK_URL = "https://charlott-unflagitious-unselfishly.ngrok-free.dev";
const isEvalTunnelUrl = (url: string) => EVAL_URL_RE.test(url) || url === EVAL_NGROK_URL;
const TOKEN_RE = /^[0-9a-fA-F]{64,}$/;
const USER_IDS_RE = /^[1-9]\d{0,9}(,[1-9]\d{0,9}){0,9}$/;
/** Local: la primera inferencia de XiYanSQL puede tardar más. */
export const DEMO_TIMEOUT_MS = 120_000;
/** Vercel: por debajo de `maxDuration` (60 s) de `app/api/assistant/route.ts`. */
export const EVAL_TIMEOUT_MS = 55_000;

function readEvalConfig(env: Record<string, string | undefined>): AssistantConfig {
  // Preview de Vercel, o Production solo con la segunda bandera explícita (deshabilitado por defecto).
  const allowed =
    env.VERCEL_ENV === "preview" ||
    (env.VERCEL_ENV === "production" && env.AI_ASSISTANT_ALLOW_PRODUCTION_EVAL === "1");
  if (!allowed) return { enabled: false, reason: "production" };
  const url = env.AI_SERVICE_URL?.trim() ?? "";
  const token = env.AI_SERVICE_INTERNAL_TOKEN?.trim() ?? "";
  const identityKey = env.AI_ASSISTANT_IDENTITY_KEY?.trim() ?? "";
  const realData = env.AI_ASSISTANT_REAL_DATA === "1";
  const usersText = (env.AI_ASSISTANT_EVAL_USER_IDS ?? "").replace(/\s/g, "");
  if (usersText && !USER_IDS_RE.test(usersText)) return { enabled: false, reason: "misconfigured" };
  const allowedUserIds = usersText ? usersText.split(",").map(Number) : null;
  if (
    !isEvalTunnelUrl(url) ||
    !TOKEN_RE.test(token) ||
    !TOKEN_RE.test(identityKey) ||
    identityKey.toLowerCase() === token.toLowerCase() ||
    // Production y datos reales: solo cuentas evaluadoras explícitas, nunca todos los ADMIN.
    ((env.VERCEL_ENV === "production" || realData) && allowedUserIds === null)
  ) {
    return { enabled: false, reason: "misconfigured" };
  }
  return {
    enabled: true, serviceUrl: url, token, identityKey, realData, demo: false, mode: "eval", timeoutMs: EVAL_TIMEOUT_MS, allowedUserIds,
  };
}

export function readAssistantConfig(env: Record<string, string | undefined> = process.env): AssistantConfig {
  if (env.AI_ASSISTANT_EVAL_ENABLED === "1") return readEvalConfig(env);
  if (env.NODE_ENV === "production") return { enabled: false, reason: "production" };
  if (env.AI_ASSISTANT_DEMO !== "1") return { enabled: false, reason: "disabled" };
  const url = env.AI_SERVICE_URL?.trim() ?? "";
  const token = env.AI_SERVICE_INTERNAL_TOKEN?.trim() ?? "";
  const identityKey = env.AI_ASSISTANT_IDENTITY_KEY?.trim() || null;
  const realData = env.AI_ASSISTANT_REAL_DATA === "1";
  const port = URL_RE.exec(url)?.[1];
  if (!port || Number(port) < 1024 || Number(port) > 65535 || !TOKEN_RE.test(token)) {
    return { enabled: false, reason: "misconfigured" };
  }
  if (identityKey !== null && (!TOKEN_RE.test(identityKey) || identityKey.toLowerCase() === token.toLowerCase())) {
    return { enabled: false, reason: "misconfigured" };
  }
  if (realData && identityKey === null) return { enabled: false, reason: "misconfigured" }; // P-9 obligatorio
  return {
    enabled: true, serviceUrl: url, token, identityKey, realData, demo: true, mode: "demo", timeoutMs: DEMO_TIMEOUT_MS, allowedUserIds: null,
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
