import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/auth/session";

/**
 * Exige sesión en todo el sistema salvo el login, la API de auth y los webhooks
 * externos (Mercado Pago llama sin cookie). Aquí solo se valida la firma del
 * token; que el usuario siga activo lo comprueba `sesionActual()` en la API.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sesion = await verificarSesion(request.cookies.get(COOKIE_SESION)?.value);

  if (pathname === "/login") {
    return sesion ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (sesion) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/webhooks).*)"],
};