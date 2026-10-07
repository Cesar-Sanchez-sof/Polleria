import { Prisma, type AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Módulos del sistema que generan registros de auditoría. */
export const MODULOS_AUDITORIA = ["Seguridad", "Usuarios", "Contabilidad", "Compras", "Ventas", "Caja"] as const;

export const ACCIONES_AUDITORIA: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
];

export interface ActorAuditoria {
  userId: number | null;
  username: string;
}

export interface DatosAuditoria {
  actor: ActorAuditoria | null;
  action: AuditAction;
  module: string;
  entity: string;
  entityId?: string | number | null;
  description: string;
  details?: unknown;
  ipAddress?: string | null;
}

export interface FiltrosAuditoria {
  desde?: string | null;
  hasta?: string | null;
  usuario?: string | null;
  accion?: string | null;
  modulo?: string | null;
  q?: string | null;
  pagina?: number;
  porPagina?: number;
}

export interface AuditoriaFilaDto {
  id: number;
  fecha: string;
  usuario: string;
  idUsuario: number | null;
  accion: AuditAction;
  modulo: string;
  entidad: string;
  idEntidad: string | null;
  descripcion: string;
  detalles: unknown;
  ip: string | null;
}

export interface ListaAuditoriaDto {
  datos: AuditoriaFilaDto[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

type Db = Pick<Prisma.TransactionClient, "auditLog">;

/** Quita datos sensibles (contraseñas, tokens) antes de guardar el detalle. */
export function sanearDetalles(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  const limpio = JSON.parse(
    JSON.stringify(valor, (clave, v) => (/pass|token|secret|hash/i.test(clave) ? "[oculto]" : v)),
  );
  return limpio ?? undefined;
}

/**
 * Registra un movimiento en la bitácora. Nunca lanza: un fallo de auditoría no debe
 * tumbar la operación de negocio (se deja en el log del servidor). Pasa `db` (tx)
 * para que el registro quede dentro de la misma transacción.
 */
export async function registrarAuditoria(datos: DatosAuditoria, db: Db = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: datos.actor?.userId ?? null,
        username: (datos.actor?.username || "sistema").slice(0, 50),
        action: datos.action,
        module: datos.module.slice(0, 50),
        entity: datos.entity.slice(0, 50),
        entityId: datos.entityId == null ? null : String(datos.entityId).slice(0, 50),
        description: datos.description.slice(0, 255),
        details: sanearDetalles(datos.details),
        ipAddress: datos.ipAddress?.slice(0, 45) ?? null,
      },
    });
  } catch (e) {
    console.error("[auditoria] no se pudo registrar:", e);
  }
}

/** IP del cliente a partir de los encabezados del proxy. */
export function ipDeSolicitud(request: Request): string | null {
  const reenviada = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || request.headers.get("x-real-ip");
}

function fechaInicio(valor: string): Date | null {
  const d = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function construirFiltro(f: FiltrosAuditoria): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const rango: Prisma.DateTimeFilter = {};
  const desde = f.desde ? fechaInicio(f.desde) : null;
  const hasta = f.hasta ? fechaInicio(f.hasta) : null;
  if (desde) rango.gte = desde;
  if (hasta) rango.lt = new Date(hasta.getTime() + 24 * 60 * 60 * 1000);
  if (rango.gte || rango.lt) where.createdAt = rango;

  if (f.usuario?.trim()) where.username = { contains: f.usuario.trim(), mode: "insensitive" };
  if (f.accion && (ACCIONES_AUDITORIA as string[]).includes(f.accion)) where.action = f.accion as AuditAction;
  if (f.modulo?.trim()) where.module = f.modulo.trim();
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
export async function listarAuditoria(f: FiltrosAuditoria = {}): Promise<ListaAuditoriaDto> {
  const porPagina = Math.min(Math.max(Math.trunc(f.porPagina ?? 20), 1), 100);
  const pagina = Math.max(Math.trunc(f.pagina ?? 1), 1);
  const where = construirFiltro(f);

  const [total, filas] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  return {
    datos: filas.map((r) => ({
      id: r.id,
      fecha: r.createdAt.toISOString(),
      usuario: r.username,
      idUsuario: r.userId,
      accion: r.action,
      modulo: r.module,
      entidad: r.entity,
      idEntidad: r.entityId,
      descripcion: r.description,
      detalles: r.details,
      ip: r.ipAddress,
    })),
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
  };
}