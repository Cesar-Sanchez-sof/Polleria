import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, COOKIE_OPTIONS, verifySession } from "@/lib/auth/session";

/**
 * ISO/IEC 27001:2022 - Controles A.5.15, A.8.3, A.8.20
 * Control de acceso perimetral con principio de mínimo privilegio y denegación por defecto (Deny by Default).
 * Endurecimiento de cabeceras HTTP de seguridad (Defense in Depth).
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(rawCookie);

  // Recursos estáticos públicos e imágenes de marca
  if (
    pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|css|js)$/i) ||
    pathname.startsWith("/images/")
  ) {
    return NextResponse.next();
  }

  // Rutas públicas de autenticación
  if (pathname === "/login") {
    if (session) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Si tiene sesión con firma criptográfica válida, permite el flujo
  if (session) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Denegación por defecto para llamadas de API sin token válido
  if (pathname.startsWith("/api/")) {
    const errorResponse = NextResponse.json(
      { error: "No autenticado", code: "UNAUTHORIZED_ACCESS" },
      { status: 401 }
    );
    return applySecurityHeaders(errorResponse);
  }

  // Redirección perimetral a /login para cualquier página protegida
  const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
  
  // Si traía una cookie inválida o expirada, se purga del navegador
  if (rawCookie) {
    redirectResponse.cookies.set(SESSION_COOKIE, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return applySecurityHeaders(redirectResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|Los_Betos_Logo.jpg|balance.png|estado_resultados.png|libro_mayor.png|restauranteCaja.html|restauranteCocina.html|api/auth/login|api/auth/recuperar|api/webhooks).*)",
  ],
};