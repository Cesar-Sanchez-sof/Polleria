import { prisma } from "@/lib/prisma";
import type { DashboardShare, DashboardRoleAccess, DashboardUserAccess } from "@prisma/client";
import { logAudit } from "@/lib/services/security/audit.service";
import { NotFoundError } from "@/lib/http/errors";

export type { DashboardShare, DashboardRoleAccess, DashboardUserAccess };

// ============================================================================
// Share Links
// ============================================================================

/**
 * Obtiene el share activo para un dashboard, o crea uno nuevo si no existe.
 * Si ya hay un enlace activo lo reutiliza (no crea duplicados).
 */
export async function getOrCreateShareLink(
  dashboardId: string,
  createdById: number,
  name: string
): Promise<DashboardShare> {
  const existing = await prisma.dashboardShare.findFirst({
    where: { dashboardId, isActive: true },
  });
  if (existing) return existing;

  const share = await prisma.dashboardShare.create({
    data: {
      dashboardId,
      createdById,
      isActive: true,
      name,
    },
  });

  // Audit
  const user = await prisma.user.findUnique({
    where: { id: createdById },
    select: { username: true },
  });
  await logAudit({
    actor: { userId: createdById, username: user?.username ?? "sistema" },
    action: "CREATE",
    module: "dashboards",
    entity: "DashboardShare",
    entityId: share.id,
    description: `Enlace compartido creado para el tablero ${dashboardId}`,
  }).catch(() => void 0);

  return share;
}

/**
 * Desactiva un share link (lo marca isActive=false).
 * No lo elimina para mantener historial de auditoría.
 */
export async function deactivateShareLink(
  shareId: string,
  actorId?: number
): Promise<void> {
  const share = await prisma.dashboardShare.findUnique({ where: { id: shareId } });
  if (!share) throw new NotFoundError("Enlace compartido no encontrado");

  await prisma.dashboardShare.update({
    where: { id: shareId },
    data: { isActive: false },
  });

  if (actorId != null) {
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { username: true },
    });
    await logAudit({
      actor: { userId: actorId, username: user?.username ?? "sistema" },
      action: "STATUS_CHANGE",
      module: "dashboards",
      entity: "DashboardShare",
      entityId: shareId,
      description: `Enlace compartido desactivado para el tablero ${share.dashboardId}`,
    }).catch(() => void 0);
  }
}

/** Lista todos los share links (activos e inactivos) de un dashboard. */
export async function listShareLinks(dashboardId: string): Promise<DashboardShare[]> {
  return prisma.dashboardShare.findMany({
    where: { dashboardId },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================================================
// Role / User Access Management
// ============================================================================

export interface AccessEntry {
  type: "role" | "user";
  id: number;
  canView: boolean;
  canEdit: boolean;
}

/**
 * Gestiona el acceso (upsert) de roles/usuarios a un dashboard.
 * canEdit siempre implica canView.
 */
export async function setDashboardAccess(
  dashboardId: string,
  entries: AccessEntry[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const canView = entry.canEdit ? true : entry.canView;
      if (entry.type === "role") {
        await tx.dashboardRoleAccess.upsert({
          where: { dashboardId_roleId: { dashboardId, roleId: entry.id } },
          create: { dashboardId, roleId: entry.id, canView, canEdit: entry.canEdit },
          update: { canView, canEdit: entry.canEdit },
        });
      } else {
        await tx.dashboardUserAccess.upsert({
          where: { dashboardId_userId: { dashboardId, userId: entry.id } },
          create: { dashboardId, userId: entry.id, canView, canEdit: entry.canEdit },
          update: { canView, canEdit: entry.canEdit },
        });
      }
    }
  });
}

/** Elimina la entrada de acceso de un rol o usuario. */
export async function removeDashboardAccess(
  dashboardId: string,
  entry: { type: "role" | "user"; id: number }
): Promise<void> {
  if (entry.type === "role") {
    await prisma.dashboardRoleAccess.deleteMany({
      where: { dashboardId, roleId: entry.id },
    });
  } else {
    await prisma.dashboardUserAccess.deleteMany({
      where: { dashboardId, userId: entry.id },
    });
  }
}

export interface DashboardAccessList {
  roles: (DashboardRoleAccess & { role: { id: number; name: string } })[];
  users: (DashboardUserAccess & { user: { id: number; username: string } })[];
}

/** Lista el acceso actual del dashboard (roles y usuarios). */
export async function getDashboardAccessList(dashboardId: string): Promise<DashboardAccessList> {
  const [roles, users] = await Promise.all([
    prisma.dashboardRoleAccess.findMany({
      where: { dashboardId },
      include: { role: { select: { id: true, name: true } } },
    }),
    prisma.dashboardUserAccess.findMany({
      where: { dashboardId },
      include: { user: { select: { id: true, username: true } } },
    }),
  ]);
  return { roles, users };
}
