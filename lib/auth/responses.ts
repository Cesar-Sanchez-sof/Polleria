import { NextResponse } from "next/server";
import { UserError } from "@/lib/services/users.service";

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

export const unauthorized = () => NextResponse.json({ error: "No autenticado" }, { status: 401 });

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}