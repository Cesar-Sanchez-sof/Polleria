import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/current-session";
import { readAssistantConfig } from "@/lib/ai-assistant/config";
import { handleQuery, handleStatus, MAX_BODY_BYTES, type ProxyDeps, type ProxyResult } from "@/lib/ai-assistant/proxy";
import { readOpenAiConfig } from "@/lib/ai-assistant/openai";
import { authorize, permissionsForUser } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
// Vercel: límite de la función (60 s cabe en todos los planes). El proxy corta antes (55 s en evaluación)
// para responder un error sencillo en lugar de que la plataforma cierre la conexión.
export const maxDuration = 60;

function deps(): ProxyDeps {
  return {
    config: readAssistantConfig(),
    openai: readOpenAiConfig(),
    geminiErp: process.env.AI_GEMINI_SQL === "1",
    groqErp: process.env.AI_GROQ_SQL === "1",
    // Con un agente (Gemini o Groq) activo, el Modelo R solo aparece si se habilita de forma explícita.
    modelR: (process.env.AI_GEMINI_SQL !== "1" && process.env.AI_GROQ_SQL !== "1") || process.env.AI_MODEL_R === "1",
    session: () => currentSession(),
    fetchFn: fetch,
    now: () => new Date(),
    newTraceId: () => `erp-${crypto.randomUUID().replaceAll("-", "")}`,
    permissions: (userId) => permissionsForUser(userId),
  };
}

function toResponse(result: ProxyResult): NextResponse {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Estado del asistente para la sesión actual (mismos controles de acceso que POST). */
export async function GET() {
  const auth = await authorize("reportes.ver");
  if (!auth.ok) return auth.response;
  return toResponse(await handleStatus(deps()));
}

/** Pregunta al asistente financiero (proxy seguro hacia ai-service). */
export async function POST(request: Request) {
  const auth = await authorize("reportes.ver");
  if (!auth.ok) return auth.response;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return toResponse({ status: 413, body: { error: "El mensaje es demasiado largo." } });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return toResponse({ status: 415, body: { error: "Formato de solicitud no admitido." } });
  }
  const raw = await request.text().catch(() => "");
  return toResponse(await handleQuery(raw, deps()));
}
