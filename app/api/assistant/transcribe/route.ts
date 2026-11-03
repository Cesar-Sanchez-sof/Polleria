import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/current-session";
import { readAssistantConfig } from "@/lib/ai-assistant/config";
import { authorize } from "@/lib/auth/permissions";
import {
  createRateLimiter,
  handleTranscribe,
  MAX_REQUEST_BYTES,
  readVoiceConfig,
  VOICE_MESSAGES,
  VOICE_RATE_LIMIT,
} from "@/lib/ai-assistant/transcribe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Límite por usuario, en memoria de la instancia (tope aproximado en serverless). */
const allow = createRateLimiter(VOICE_RATE_LIMIT.max, VOICE_RATE_LIMIT.windowMs);

function toResponse(result: { status: number; body: Record<string, unknown> }): NextResponse {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Dictado por voz: audio → texto para la caja de pregunta (`AI_ASSISTANT_VOICE=1`). */
export async function POST(request: Request) {
  const auth = await authorize("reportes.ver");
  if (!auth.ok) return auth.response;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    return toResponse({ status: 413, body: { error: VOICE_MESSAGES.tooLarge } });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return toResponse({ status: 415, body: { error: VOICE_MESSAGES.unsupported } });
  }
  const form = await request.formData().catch(() => null);
  return toResponse(
    await handleTranscribe(form, {
      config: readAssistantConfig(),
      voice: readVoiceConfig(),
      session: () => currentSession(),
      fetchFn: fetch,
      allow,
    }),
  );
}
