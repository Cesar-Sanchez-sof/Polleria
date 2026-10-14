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
 * Modo evaluación académica (despliegue en Vercel, ver docs/asistente-financiero/despliegue-evaluacion.md):
 * - `AI_ASSISTANT_EVAL_ENABLED`: exactamente `1`. Surte efecto con `VERCEL_ENV=preview` (Vercel lo fija
 *   en cada despliegue). Con `VERCEL_ENV=production` exige ADEMÁS `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL=1`
 *   (habilitación temporal y explícita para la evaluación). En `development` o fuera de Vercel queda
 *   deshabilitado. `NODE_ENV` no sirve para distinguirlos: Preview y Production compilan con `production`.
 *   Ambas banderas son privadas del servidor (sin `NEXT_PUBLIC_`).
 * - `AI_SERVICE_URL`: exactamente `https://<subdominio>.trycloudflare.com` (túnel temporal hacia el
 *   FastAPI local). `AI_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY` (P-9) son obligatorios.
 * - Siempre datos ficticios: `AI_ASSISTANT_REAL_DATA=1` invalida la configuración (falla cerrado).
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
    }
  | { enabled: false; reason: "production" | "disabled" | "misconfigured" };

const URL_RE = /^http:\/\/127\.0\.0\.1:(\d{4,5})$/;
const EVAL_URL_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/;
const TOKEN_RE = /^[0-9a-fA-F]{64,}$/;
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
  if (
    !EVAL_URL_RE.test(url) ||
    !TOKEN_RE.test(token) ||
    !TOKEN_RE.test(identityKey) ||
    identityKey.toLowerCase() === token.toLowerCase() ||
    env.AI_ASSISTANT_REAL_DATA === "1" // la evaluación nunca usa datos financieros reales
  ) {
    return { enabled: false, reason: "misconfigured" };
  }
  return { enabled: true, serviceUrl: url, token, identityKey, realData: false, demo: false, mode: "eval", timeoutMs: EVAL_TIMEOUT_MS };
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
  return { enabled: true, serviceUrl: url, token, identityKey, realData, demo: true, mode: "demo", timeoutMs: DEMO_TIMEOUT_MS };
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
