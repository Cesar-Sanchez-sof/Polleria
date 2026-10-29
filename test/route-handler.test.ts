import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  createApiHandler,
  NotFoundError,
  ConflictError,
} from "@/lib/http/route-handler";
import * as authPermissions from "@/lib/auth/permissions";

describe("createApiHandler - Helper común de Route Handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna 200 con el payload devuelto por el servicio", async () => {
    const handler = createApiHandler({
      handler: async () => {
        return { message: "ok", count: 5 };
      },
    });

    const req = new NextRequest("http://localhost:3000/api/test");
    const response = await handler(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ message: "ok", count: 5 });
  });

  it("retorna 201 por defecto en peticiones POST exitosas", async () => {
    const handler = createApiHandler<{ name: string }>({
      handler: async ({ body }) => {
        return { id: 10, ...(body as Record<string, unknown>) };
      },
    });

    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mesa 1" }),
    });

    const response = await handler(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toEqual({ id: 10, name: "Mesa 1" });
  });

  it("rechaza la petición si el usuario no tiene los permisos requeridos", async () => {
    vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: "No tienes permiso para realizar esta acción" },
        { status: 403 }
      ),
    });

    const serviceMock = vi.fn();
    const handler = createApiHandler({
      permission: "ventas.crear",
      handler: serviceMock,
    });

    const req = new NextRequest("http://localhost:3000/api/sales", { method: "POST" });
    const response = await handler(req);

    expect(response.status).toBe(403);
    expect(serviceMock).not.toHaveBeenCalled();
    const data = await response.json();
    expect(data.error).toBe("No tienes permiso para realizar esta acción");
  });

  it("permite el paso e inyecta la sesión si el permiso es válido", async () => {
    vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
      ok: true,
      session: { userId: 1, email: "admin@polleria.pe", roleId: 1, roleName: "ADMIN" } as any,
      superuser: true,
    });

    let capturedSession: any = null;
    const handler = createApiHandler({
      permission: "ventas.crear",
      handler: async ({ session }) => {
        capturedSession = session;
        return { success: true };
      },
    });

    const req = new NextRequest("http://localhost:3000/api/sales", { method: "POST" });
    const response = await handler(req);

    expect(response.status).toBe(201);
    expect(capturedSession).toBeDefined();
    expect(capturedSession.email).toBe("admin@polleria.pe");
  });

  it("mapea NotFoundError a código HTTP 404", async () => {
    const handler = createApiHandler({
      handler: async () => {
        throw new NotFoundError("La mesa no fue encontrada.");
      },
    });

    const req = new NextRequest("http://localhost:3000/api/tables/99");
    const response = await handler(req);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("La mesa no fue encontrada.");
  });

  it("mapea ConflictError a código HTTP 409", async () => {
    const handler = createApiHandler({
      handler: async () => {
        throw new ConflictError("El pedido ya se encuentra cerrado.");
      },
    });

    const req = new NextRequest("http://localhost:3000/api/orders/1/close", { method: "POST" });
    const response = await handler(req);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("El pedido ya se encuentra cerrado.");
  });

  it("valida el esquema del body y retorna 400 si la validación falla", async () => {
    const handler = createApiHandler({
      schema: (raw: any) => {
        if (!raw || typeof raw.name !== "string" || raw.name.length < 3) {
          throw new Error("El nombre debe tener al menos 3 caracteres.");
        }
        return raw;
      },
      handler: async ({ body }) => {
        return body;
      },
    });

    const req = new NextRequest("http://localhost:3000/api/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });

    const response = await handler(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Datos de solicitud inválidos.");
    expect(data.details).toContain("El nombre debe tener al menos 3 caracteres.");
  });

  it("captura errores inesperados y retorna 500 sanitizado", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = createApiHandler({
      handler: async () => {
        throw new Error("Fallo de conexión crítico en PostgreSQL");
      },
    });

    const req = new NextRequest("http://localhost:3000/api/crash");
    const response = await handler(req);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Ha ocurrido un error interno en el servidor.");
    expect(consoleSpy).toHaveBeenCalled();
  });
});
