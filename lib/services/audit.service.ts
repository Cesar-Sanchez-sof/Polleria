import { Prisma, type AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Módulos del sistema que generan registros de auditoría. */
export const AUDIT_MODULES = ["Seguridad", "Usuarios", "Contabilidad", "Compras", "Ventas", "Caja"] as const;

export const AUDIT_ACTIONS: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
];

export interface AuditActor {
  userId: number | null;
  username: string;
}

export interface AuditData {
  actor: AuditActor | null;
  action: AuditAction;
  module: string;
  entity: string;
  entityId?: string | number | null;
  description: string;
  details?: unknown;
  ipAddress?: string | null;
}

export interface AuditFilters {
  from?: string | null;
  to?: string | null;
  user?: string | null;
  action?: string | null;
  module?: string | null;
  q?: string | null;
  page?: number;
  perPage?: number;
}

export interface AuditRowDto {
  id: number;
  date: string;
  user: string;
  userId: number | null;
  action: AuditAction;
  module: string;
  entity: string;
  entityId: string | null;
  description: string;
  details: unknown;
  ip: string | null;
}

export interface AuditListDto {
  data: AuditRowDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

type Db = Pick<Prisma.TransactionClient, "auditLog">;

/** Quita datos sensibles (contraseñas, tokens) antes de guardar el detalle. */
export function sanitizeDetails(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const clean = JSON.parse(
    JSON.stringify(value, (key, v) => (/pass|token|secret|hash/i.test(key) ? "[oculto]" : v)),
  );
  return clean ?? undefined;
}

/**
 * Registra un movimiento en la bitácora. Nunca lanza: un fallo de auditoría no debe
 * tumbar la operación de negocio (se deja en el log del servidor). Pasa `db` (tx)
 * para que el registro quede dentro de la misma transacción.
 */
export async function logAudit(data: AuditData, db: Db = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: data.actor?.userId ?? null,
        username: (data.actor?.username || "sistema").slice(0, 50),
        action: data.action,
        module: data.module.slice(0, 50),
        entity: data.entity.slice(0, 50),
        entityId: data.entityId == null ? null : String(data.entityId).slice(0, 50),
        description: data.description.slice(0, 255),
        details: sanitizeDetails(data.details),
        ipAddress: data.ipAddress?.slice(0, 45) ?? null,
      },
    });
  } catch (e) {
    console.error("[auditoria] no se pudo registrar:", e);
  }
}

/** IP del cliente a partir de los encabezados del proxy. */
export function requestIp(request: Request): string | null {
  const resent = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return resent || request.headers.get("x-real-ip");
}

function startDate(value: string): Date | null {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildFilter(f: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const range: Prisma.DateTimeFilter = {};
  const from = f.from ? startDate(f.from) : null;
  const to = f.to ? startDate(f.to) : null;
  if (from) range.gte = from;
  if (to) range.lt = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  if (range.gte || range.lt) where.createdAt = range;

  if (f.user?.trim()) where.username = { contains: f.user.trim(), mode: "insensitive" };
  if (f.action && (AUDIT_ACTIONS as string[]).includes(f.action)) where.action = f.action as AuditAction;
  if (f.module?.trim()) where.module = f.module.trim();
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { entity: { contains: q, mode: "insensitive" } },
      { entityId: q },
    ];
  }
  return where;
}

/** Lista paginada (más recientes primero) con filtros por fecha, usuario, acción y módulo. */
export async function listAudit(f: AuditFilters = {}): Promise<AuditListDto> {
  const perPage = Math.min(Math.max(Math.trunc(f.perPage ?? 20), 1), 100);
  const page = Math.max(Math.trunc(f.page ?? 1), 1);
  const where = buildFilter(f);

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      date: r.createdAt.toISOString(),
      user: r.username,
      userId: r.userId,
      action: r.action,
      module: r.module,
      entity: r.entity,
      entityId: r.entityId,
      description: r.description,
      details: r.details,
      ip: r.ipAddress,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1),
  };
}