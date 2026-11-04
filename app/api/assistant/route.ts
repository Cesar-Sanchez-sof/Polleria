import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/current-session";
import { readAssistantConfig } from "@/lib/ai-assistant/config";
import { handleQuery, handleStatus, MAX_BODY_BYTES, type ProxyDeps, type ProxyResult } from "@/lib/ai-assistant/proxy";
import { readVoiceConfig } from "@/lib/ai-assistant/transcribe";
import { authorize, permissionsForUser } from "@/lib/auth/permissions";
import { getDeveloperFlags } from "@/lib/services/developer-settings.service";

export const dynamic = "force-dynamic";
// Vercel: límite de la función (60 s cabe en todos los planes). El proxy corta antes (55 s en evaluación)
// para responder un error sencillo en lugar de que la plataforma cierre la conexión.
export const maxDuration = 60;

async function deps(): Promise<ProxyDeps> {
  const flags = await getDeveloperFlags();
  const geminiErp = flags["assistant.gemini_sql"];
  const groqErp = flags["assistant.groq_sql"];
  return {
    config: readAssistantConfig(flags),
    voice: readVoiceConfig(flags).enabled,
    geminiErp,
    groqErp,
    // Con un agente (Gemini o Groq) activo, el Modelo R solo aparece si se habilita de forma explícita.
    modelR: (!geminiErp && !groqErp) || flags["assistant.model_r"],
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
  return toResponse(await handleStatus(await deps()));
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
  return toResponse(await handleQuery(raw, await deps()));
}
