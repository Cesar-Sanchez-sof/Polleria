import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/responses";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Jerarquía de errores de dominio y aplicación para mapeo HTTP uniforme.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Error de validación en la solicitud.", details?: unknown) {
    super(message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "No autenticado") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "No tienes permiso para realizar esta acción") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export interface HandlerContext<TBody = unknown, TParams = Record<string, string | string[]>> {
  req: NextRequest;
  session?: SessionPayload;
  superuser: boolean;
  body: TBody;
  params: TParams;
  searchParams: URLSearchParams;
}

export interface RouteHandlerConfig<TBody = unknown, TParams = Record<string, string | string[]>> {
  /** Permiso granular o lista de permisos requeridos (RBAC). */
  permission?: string | string[];
  /** Exige sesión activa aunque no se requiera un permiso específico. */
  requireAuth?: boolean;
  /** Función o schema validador (e.g. zodSchema.parse) para validar el body. */
  schema?: (raw: unknown) => TBody;
  /** Código HTTP exitoso por defecto (200 o 201). */
  successStatus?: number;
  /** Lógica del handler que interactúa con la capa de servicios. */
  handler: (ctx: HandlerContext<TBody, TParams>) => Promise<unknown>;
}

/**
 * Helper estándar para route handlers en app/api.
 * Centraliza autorización RBAC, parseo/validación de entrada y mapeo de errores.
 */
export function createApiHandler<TBody = unknown, TParams = Record<string, string | string[]>>(
  config: RouteHandlerConfig<TBody, TParams>
) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<TParams> | TParams }
  ): Promise<Response> => {
    try {
      let session: SessionPayload | undefined;
      let superuser = false;

      // 1. Verificación de Autorización y Permisos (RBAC)
      if (config.permission) {
        const auth = await authorize(config.permission);
        if (!auth.ok) {
          return auth.response;
        }
        session = auth.session;
        superuser = auth.superuser;
      } else if (config.requireAuth) {
        const activeSession = await currentSession().catch(() => null);
        if (!activeSession) {
          return unauthorized();
        }
        session = activeSession;
      }

      // 2. Parseo y Validación de Body (para métodos con carga útil)
      let parsedBody = undefined as TBody;
      const method = req.method.toUpperCase();
      if (["POST", "PUT", "PATCH"].includes(method)) {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const raw = await req.json().catch(() => null);
          if (config.schema) {
            try {
              parsedBody = config.schema(raw);
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : "Datos de solicitud inválidos.";
              throw new ValidationError("Datos de solicitud inválidos.", errorMessage);
            }
          } else {
            parsedBody = raw as TBody;
          }
        }
      }

      // 3. Resolución de parámetros de ruta y query string
      const resolvedParams = context?.params
        ? (context.params instanceof Promise ? await context.params : context.params)
        : ({} as TParams);
      const searchParams = req.nextUrl?.searchParams || new URL(req.url).searchParams;

      // 4. Ejecución del Handler de Dominio
      const result = await config.handler({
        req,
        session,
        superuser,
        body: parsedBody,
        params: resolvedParams,
        searchParams,
      });

      // 5. Manejo de respuesta exitosa
      if (result instanceof Response || result instanceof NextResponse) {
        return result;
      }

      const status = config.successStatus || (method === "POST" && result ? 201 : 200);
      return NextResponse.json(result, { status });
    } catch (error: unknown) {
      // 6. Mapeo estructurado de excepciones de Dominio
      if (error instanceof DomainError) {
        return NextResponse.json(
          {
            error: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
          },
          { status: error.statusCode }
        );
      }

      // Errores conocidos de violación de restricciones únicas (Prisma P2002)
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Conflicto: Ya existe un registro con los mismos datos únicos." },
          { status: 409 }
        );
      }

      // 7. Error interno no controlado
      console.error("[createApiHandler Unhandled Error]:", error);
      return NextResponse.json(
        { error: "Ha ocurrido un error interno en el servidor." },
        { status: 500 }
      );
    }
  };
}
