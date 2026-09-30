import { NextResponse } from "next/server";
import { ErrorUsuario } from "@/lib/services/usuarios.service";

export function respuestaError(e: unknown): NextResponse {
  if (e instanceof ErrorUsuario) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

export const noAutorizado = () => NextResponse.json({ error: "No autenticado" }, { status: 401 });

export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo = await request.json();
    return cuerpo && typeof cuerpo === "object" ? (cuerpo as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}