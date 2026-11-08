import { headers } from "next/headers";
import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/security/audit.service";

/**
 * Auditoría de las operaciones de compras (server actions): quién hizo qué, cuándo, desde
 * qué IP y con qué montos. Se registra después de confirmar la transacción para que un
 * fallo de la bitácora nunca revierta una compra.
 */
export const PURCHASES_AUDIT_MODULE = "Compras";

async function actionIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  } catch {
    return null; // fuera de una petición (tests, scripts)
  }
}

/** Empleado del usuario con sesión: las compras quedan a nombre de quien las registra. */
export async function sessionEmployeeId(session: SessionPayload | undefined | null): Promise<number | undefined> {
  if (!session?.userId) return undefined;
  try {
    const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { employeeId: true } });
    return u?.employeeId ?? undefined;
  } catch {
    return undefined;
  }
}

export async function auditPurchase(
  session: SessionPayload | undefined | null,
  data: {
    action: AuditAction;
    entity: string;
    entityId?: string | number | null;
    description: string;
    details?: unknown;
  },
): Promise<void> {
  await logAudit({
    actor: session ? { userId: session.userId, username: session.username } : null,
    module: PURCHASES_AUDIT_MODULE,
    ipAddress: await actionIp(),
    ...data,
  });
}

/** Convierte Decimals y fechas a valores planos para el detalle de auditoría. */
export function plain<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}
