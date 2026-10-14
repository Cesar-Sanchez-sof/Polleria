import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { hasRolePermission } from "../lib/auth/guard";
import { SESSION_COOKIE, signSession } from "../lib/auth/session";

describe("Seguridad ISO/IEC 27001:2022 - Control de Acceso y Perímetro (A.5.15, A.8.3, A.8.20)", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "12345678901234567890123456789012";
  });

  it("A.5.15: Deniega acceso a la raíz '/' sin autenticación y redirige a /login (Deny by Default)", async () => {
    const request = new NextRequest("http://localhost:3000/");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("A.8.20: Inyecta cabeceras HTTP de endurecimiento de seguridad (Defense in Depth)", async () => {
    const request = new NextRequest("http://localhost:3000/");
    const response = await proxy(request);

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("A.8.3: Deniega acceso a llamadas API protegidas sin sesión con HTTP 401", async () => {
    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await proxy(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("No autenticado");
    expect(body.code).toBe("UNAUTHORIZED_ACCESS");
  });

  it("A.8.5: Si el usuario ya está autenticado con JWT válido, permite acceso a '/'", async () => {
    const token = await signSession({ userId: 1, username: "admin", role: "ADMIN" });
    const request = new NextRequest("http://localhost:3000/", {
      headers: {
        cookie: `${SESSION_COOKIE}=${token}`,
      },
    });

    const response = await proxy(request);
    // NextResponse.next() continúa el flujo normal (status 200 en proxy middleware)
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("A.8.5: Si un usuario con sesión activa intenta ir a /login, lo redirige al inicio '/'", async () => {
    const token = await signSession({ userId: 1, username: "admin", role: "ADMIN" });
    const request = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: `${SESSION_COOKIE}=${token}`,
      },
    });

    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("A.5.15: Si el navegador envía un token inválido o corrupto, purga la cookie en la redirección", async () => {
    const request = new NextRequest("http://localhost:3000/sales", {
      headers: {
        cookie: `${SESSION_COOKIE}=token_invalido_corrupto`,
      },
    });

    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");

    // Comprobar que la cookie residual fue purgada
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("Max-Age=0");
  });

  it("A.8.3: Verifica el control de acceso basado en roles (RBAC)", () => {
    expect(hasRolePermission("ADMIN", ["MOZO", "COCINERO"])).toBe(true); // ADMIN siempre tiene acceso
    expect(hasRolePermission("MOZO", ["MOZO"])).toBe(true);
    expect(hasRolePermission("COCINERO", ["MOZO"])).toBe(false);
  });
});
