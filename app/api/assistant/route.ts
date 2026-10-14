import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { readAssistantConfig } from "@/lib/ai-assistant/config";
import { handleQuery, handleStatus, MAX_BODY_BYTES, type ProxyDeps, type ProxyResult } from "@/lib/ai-assistant/proxy";
import { autorizar } from "@/lib/auth/permisos";

export const dynamic = "force-dynamic";
// Vercel: límite de la función (60 s cabe en todos los planes). El proxy corta antes (55 s en evaluación)
// para responder un error sencillo en lugar de que la plataforma cierre la conexión.
export const maxDuration = 60;

function deps(): ProxyDeps {
  return {
    config: readAssistantConfig(),
    session: () => sesionActual(),
    fetchFn: fetch,
    now: () => new Date(),
    newTraceId: () => `erp-${crypto.randomUUID().replaceAll("-", "")}`,
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
  const auth = await autorizar("reportes.ver");
  if (!auth.ok) return auth.respuesta;
  return toResponse(await handleStatus(deps()));
}

/** Pregunta al asistente financiero (proxy seguro hacia ai-service). */
export async function POST(request: Request) {
  const auth = await autorizar("reportes.ver");
  if (!auth.ok) return auth.respuesta;
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
