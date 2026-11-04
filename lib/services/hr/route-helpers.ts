import { NextResponse } from "next/server";
import type { AuditAction } from "@prisma/client";
import { unauthorized } from "@/lib/auth/responses";
import { currentSession } from "@/lib/auth/current-session";
import type { SessionPayload } from "@/lib/auth/session";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { employeeIdOfUser } from "@/lib/services/employees.service";

export type IdContext = { params: Promise<{ id: string }> };

/** Id numérico de la ruta dinámica, o `null` si no es válido. */
export async function routeId(ctx: IdContext): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const badRequest = (error = "Petición inválida") => NextResponse.json({ error }, { status: 400 });

export function optionalInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Registra en la bitácora una operación de Recursos Humanos. */
export async function auditHr(
  session: SessionPayload,
  request: Request,
  data: {
    action: AuditAction;
    module: "Empleados" | "Contratos" | "Horarios" | "Asistencia" | "Vacaciones" | "Beneficios" | "Planilla";
    entity: string;
    entityId?: string | number | null;
    description: string;
    details?: unknown;
  },
) {
  await logAudit({
    actor: { userId: session.userId, username: session.username },
    ipAddress: requestIp(request),
    ...data,
  });
}

export type SelfResult =
  | { ok: true; session: SessionPayload; employeeId: number }
  | { ok: false; response: NextResponse };

/** Autoservicio: exige sesión y que el usuario esté vinculado a un empleado. */
export async function requireSelf(): Promise<SelfResult> {
  const session = await currentSession().catch(() => null);
  if (!session) return { ok: false, response: unauthorized() };
  const employeeId = await employeeIdOfUser(session.userId);
  if (!employeeId) {
    return { ok: false, response: NextResponse.json({ error: "Tu usuario no está vinculado a un empleado" }, { status: 404 }) };
  }
  return { ok: true, session, employeeId };
}
