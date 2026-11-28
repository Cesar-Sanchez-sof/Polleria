import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  createApiHandler,
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/http/route-handler";
import * as authPermissions from "@/lib/auth/permissions";
import * as authSession from "@/lib/auth/current-session";
import type { SessionPayload } from "@/lib/auth/session";

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
        return { id: 10, ...body };
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
    const mockSession: SessionPayload = {
      userId: 1,
      username: "admin",
      role: "ADMIN",
    };

    vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
      ok: true,
      session: mockSession,
      superuser: true,
    });

    let capturedSession: SessionPayload | undefined;
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
    expect(capturedSession?.username).toBe("admin");
  });

  it("retorna 401 si requireAuth es true y no existe sesión", async () => {
    vi.spyOn(authSession, "currentSession").mockResolvedValueOnce(null);

    const handler = createApiHandler({
      requireAuth: true,
      handler: async () => ({ ok: true }),
    });

    const req = new NextRequest("http://localhost:3000/api/profile");
    const response = await handler(req);

    expect(response.status).toBe(401);
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

  it("valida el esquema del body con función y retorna 400 si la validación falla", async () => {
    const handler = createApiHandler<{ name: string }>({
      schema: (raw: unknown) => {
        const item = raw as { name?: unknown };
        if (!item || typeof item.name !== "string" || item.name.length < 3) {
          throw new Error("El nombre debe tener al menos 3 caracteres.");
        }
        return { name: item.name };
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

  it("soporta esquemas tipo objeto con método parse (Zod schema)", async () => {
    const mockZodSchema = {
      parse: (raw: unknown) => {
        const item = raw as { code?: unknown };
        if (!item || typeof item.code !== "string") {
          throw new Error("Código requerido");
        }
        return { code: item.code };
      },
    };

    const handler = createApiHandler<{ code: string }>({
      schema: mockZodSchema,
      handler: async ({ body }) => {
        return { registered: body.code };
      },
    });

    const req = new NextRequest("http://localhost:3000/api/test-schema", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "COD123" }),
    });

    const response = await handler(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toEqual({ registered: "COD123" });
  });

  it("mapea errores únicos de base de datos Prisma P2002 a HTTP 409", async () => {
    const handler = createApiHandler({
      handler: async () => {
        const prismaError = new Error("Unique constraint failed");
        Object.assign(prismaError, { code: "P2002" });
        throw prismaError;
      },
    });

    const req = new NextRequest("http://localhost:3000/api/users", { method: "POST" });
    const response = await handler(req);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain("Conflicto");
  });

  it("mapea ValidationError y otras excepciones de dominio a sus status correspondientes", async () => {
    const handlerVal = createApiHandler({
      handler: async () => {
        throw new ValidationError("Rango de fechas inválido", { field: "date" });
      },
    });

    const resVal = await handlerVal(new NextRequest("http://localhost:3000/api/reports"));
    expect(resVal.status).toBe(400);
    const dataVal = await resVal.json();
    expect(dataVal.details).toEqual({ field: "date" });

    const handlerForb = createApiHandler({
      handler: async () => {
        throw new ForbiddenError();
      },
    });
    const resForb = await handlerForb(new NextRequest("http://localhost:3000/api/restricted"));
    expect(resForb.status).toBe(403);

    const handlerUnauth = createApiHandler({
      handler: async () => {
        throw new UnauthorizedError();
      },
    });
    const resUnauth = await handlerUnauth(new NextRequest("http://localhost:3000/api/secret"));
    expect(resUnauth.status).toBe(401);
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
