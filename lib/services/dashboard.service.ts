import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  Dashboard,
  DashboardSection,
  DashboardWidget,
  DashboardShare,
  Role,
  User,
} from "@prisma/client";

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export interface RoleAccessInput {
  roleId: number;
  canView: boolean;
  canEdit: boolean;
}

export interface UserAccessInput {
  userId: number;
  canView: boolean;
  canEdit: boolean;
}

export interface CreateDashboardData {
  name: string;
  sectionId: string;
  accessGroups?: string[];
  allowedUsers?: string[];
  isPublished?: boolean;
  createdById: number;
  roleAccess?: RoleAccessInput[];
  userAccess?: UserAccessInput[];
}

export interface UpdateDashboardData {
  name?: string;
  sectionId?: string;
  isPublished?: boolean;
  roleAccess?: RoleAccessInput[];
  userAccess?: UserAccessInput[];
}

export interface DashboardWidgetInput {
  title: string;
  type: string;
  metricKey: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: Prisma.InputJsonValue | null;
}

export type DashboardWithSection = Prisma.DashboardGetPayload<{
  include: { section: true };
}>;

export type DashboardWithDetails = Prisma.DashboardGetPayload<{
  include: {
    section: true;
    roleAccess: { include: { role: true } };
    userAccess: { include: { user: true } };
  };
}>;

export type DashboardWithWidgetsAndSection = Prisma.DashboardGetPayload<{
  include: {
    section: true;
    widgets: true;
    roleAccess: { include: { role: true } };
    userAccess: { include: { user: true } };
  };
}>;

export type DashboardShareWithDetails = Prisma.DashboardShareGetPayload<{
  include: {
    dashboard: {
      include: {
        section: true;
      };
    };
    createdBy: {
      select: {
        id: true;
        username: true;
        email: true;
      };
    };
  };
}>;

// ============================================================================
// Métodos de Secciones (DashboardSection)
// ============================================================================

/**
 * Devuelve todas las secciones ordenadas por el campo `order` de forma ascendente.
 */
export async function getSections(): Promise<DashboardSection[]> {
  try {
    return await prisma.dashboardSection.findMany({
      orderBy: {
        order: "asc",
      },
    });
  } catch (error) {
    console.error("Error al obtener las secciones de tableros:", error);
    throw error;
  }
}

/**
 * Crea una nueva sección de tableros.
 */
export async function createSection(
  name: string,
  order?: number
): Promise<DashboardSection> {
  try {
    return await prisma.dashboardSection.create({
      data: {
        name,
        ...(order !== undefined ? { order } : {}),
      },
    });
  } catch (error) {
    console.error("Error al crear la sección de tablero:", error);
    throw error;
  }
}

/**
 * Actualiza el nombre de una sección.
 */
export async function updateSection(
  id: string,
  name: string
): Promise<DashboardSection> {
  try {
    return await prisma.dashboardSection.update({
      where: { id },
      data: { name },
    });
  } catch (error) {
    console.error(`Error al actualizar la sección ${id}:`, error);
    throw error;
  }
}

/**
 * Actualiza el orden de múltiples secciones (Drag & Drop).
 */
export async function reorderSections(
  sectionOrders: { id: string; order: number }[]
): Promise<void> {
  try {
    await prisma.$transaction(
      sectionOrders.map(({ id, order }) =>
        prisma.dashboardSection.update({
          where: { id },
          data: { order },
        })
      )
    );
  } catch (error) {
    console.error("Error al reordenar secciones:", error);
    throw error;
  }
}

/**
 * Elimina una o más secciones por sus IDs.
 */
export async function deleteSections(ids: string[]): Promise<number> {
  try {
    const res = await prisma.dashboardSection.deleteMany({
      where: { id: { in: ids } },
    });
    return res.count;
  } catch (error) {
    console.error("Error al eliminar secciones:", error);
    throw error;
  }
}

// ============================================================================
// Métodos de Tableros (Dashboard)
// ============================================================================

/**
 * Devuelve todos los tableros incluyendo los datos de su sección, roles y usuarios con acceso.
 */
export async function getDashboards(): Promise<DashboardWithDetails[]> {
  try {
    return await prisma.dashboard.findMany({
      include: {
        section: true,
        roleAccess: {
          include: {
            role: true,
          },
        },
        userAccess: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("Error al obtener los tableros:", error);
    throw error;
  }
}

/**
 * Crea un nuevo tablero usando una transacción para registrar Dashboard,
 * DashboardRoleAccess y DashboardUserAccess.
 */
export async function createDashboard(
  data: CreateDashboardData
): Promise<DashboardWithDetails> {
  try {
    return await prisma.$transaction(async (tx) => {
      const dashboard = await tx.dashboard.create({
        data: {
          name: data.name,
          sectionId: data.sectionId,
          accessGroups: data.accessGroups ?? [],
          allowedUsers: data.allowedUsers ?? [],
          isPublished: data.isPublished ?? false,
          createdById: data.createdById,
        },
      });

      if (data.roleAccess && data.roleAccess.length > 0) {
        await tx.dashboardRoleAccess.createMany({
          data: data.roleAccess.map((ra) => ({
            dashboardId: dashboard.id,
            roleId: ra.roleId,
            canView: ra.canView,
            canEdit: ra.canEdit,
          })),
        });
      }

      if (data.userAccess && data.userAccess.length > 0) {
        await tx.dashboardUserAccess.createMany({
          data: data.userAccess.map((ua) => ({
            dashboardId: dashboard.id,
            userId: ua.userId,
            canView: ua.canView,
            canEdit: ua.canEdit,
          })),
        });
      }

      return await tx.dashboard.findUniqueOrThrow({
        where: { id: dashboard.id },
        include: {
          section: true,
          roleAccess: { include: { role: true } },
          userAccess: { include: { user: true } },
        },
      });
    });
  } catch (error) {
    console.error("Error al crear el tablero:", error);
    throw error;
  }
}

/**
 * Actualiza un tablero y sus permisos de acceso asociados.
 */
export async function updateDashboard(
  id: string,
  data: UpdateDashboardData
): Promise<DashboardWithDetails> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.dashboard.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.sectionId !== undefined ? { sectionId: data.sectionId } : {}),
          ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        },
      });

      if (data.roleAccess !== undefined) {
        await tx.dashboardRoleAccess.deleteMany({
          where: { dashboardId: id },
        });
        if (data.roleAccess.length > 0) {
          await tx.dashboardRoleAccess.createMany({
            data: data.roleAccess.map((ra) => ({
              dashboardId: id,
              roleId: ra.roleId,
              canView: ra.canView,
              canEdit: ra.canEdit,
            })),
          });
        }
      }

      if (data.userAccess !== undefined) {
        await tx.dashboardUserAccess.deleteMany({
          where: { dashboardId: id },
        });
        if (data.userAccess.length > 0) {
          await tx.dashboardUserAccess.createMany({
            data: data.userAccess.map((ua) => ({
              dashboardId: id,
              userId: ua.userId,
              canView: ua.canView,
              canEdit: ua.canEdit,
            })),
          });
        }
      }

      return await tx.dashboard.findUniqueOrThrow({
        where: { id },
        include: {
          section: true,
          roleAccess: { include: { role: true } },
          userAccess: { include: { user: true } },
        },
      });
    });
  } catch (error) {
    console.error(`Error al actualizar el tablero ${id}:`, error);
    throw error;
  }
}

/**
 * Cambia el estado publicado (Toggle) de un tablero.
 */
export async function toggleDashboardPublished(
  id: string,
  isPublished: boolean
): Promise<Dashboard> {
  try {
    return await prisma.dashboard.update({
      where: { id },
      data: { isPublished },
    });
  } catch (error) {
    console.error(`Error al alternar estado publicado del tablero ${id}:`, error);
    throw error;
  }
}

/**
 * Duplica un tablero con su configuración y widgets existentes.
 */
export async function duplicateDashboard(
  id: string,
  createdById: number
): Promise<DashboardWithDetails> {
  try {
    const original = await prisma.dashboard.findUniqueOrThrow({
      where: { id },
      include: {
        widgets: true,
        roleAccess: true,
        userAccess: true,
      },
    });

    return await prisma.$transaction(async (tx) => {
      const duplicated = await tx.dashboard.create({
        data: {
          name: `${original.name} (Copia)`,
          sectionId: original.sectionId,
          isPublished: false,
          createdById,
        },
      });

      if (original.widgets.length > 0) {
        await tx.dashboardWidget.createMany({
          data: original.widgets.map((w) => ({
            dashboardId: duplicated.id,
            title: w.title,
            type: w.type,
            metricKey: w.metricKey,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            config: w.config ?? undefined,
          })),
        });
      }

      if (original.roleAccess.length > 0) {
        await tx.dashboardRoleAccess.createMany({
          data: original.roleAccess.map((ra) => ({
            dashboardId: duplicated.id,
            roleId: ra.roleId,
            canView: ra.canView,
            canEdit: ra.canEdit,
          })),
        });
      }

      if (original.userAccess.length > 0) {
        await tx.dashboardUserAccess.createMany({
          data: original.userAccess.map((ua) => ({
            dashboardId: duplicated.id,
            userId: ua.userId,
            canView: ua.canView,
            canEdit: ua.canEdit,
          })),
        });
      }

      return await tx.dashboard.findUniqueOrThrow({
        where: { id: duplicated.id },
        include: {
          section: true,
          roleAccess: { include: { role: true } },
          userAccess: { include: { user: true } },
        },
      });
    });
  } catch (error) {
    console.error(`Error al duplicar el tablero ${id}:`, error);
    throw error;
  }
}

/**
 * Elimina uno o varios tableros por ID.
 */
export async function deleteDashboards(ids: string[]): Promise<number> {
  try {
    const res = await prisma.dashboard.deleteMany({
      where: { id: { in: ids } },
    });
    return res.count;
  } catch (error) {
    console.error("Error al eliminar tableros:", error);
    throw error;
  }
}

/**
 * Devuelve un tablero por su ID, incluyendo sus widgets ordenados por posición
 * (y: 'asc', x: 'asc'), datos de sección y accesos.
 */
export async function getDashboardById(
  id: string
): Promise<DashboardWithWidgetsAndSection | null> {
  try {
    return await prisma.dashboard.findUnique({
      where: { id },
      include: {
        section: true,
        widgets: {
          orderBy: [{ y: "asc" }, { x: "asc" }],
        },
        roleAccess: { include: { role: true } },
        userAccess: { include: { user: true } },
      },
    });
  } catch (error) {
    console.error(`Error al obtener el tablero con ID ${id}:`, error);
    throw error;
  }
}

/**
 * Actualiza los widgets de un tablero de manera atómica (dentro de una transacción).
 */
export async function updateDashboardWidgets(
  id: string,
  widgetsData: DashboardWidgetInput[]
): Promise<DashboardWidget[]> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.dashboardWidget.deleteMany({
        where: { dashboardId: id },
      });

      if (widgetsData && widgetsData.length > 0) {
        await tx.dashboardWidget.createMany({
          data: widgetsData.map((widget) => ({
            dashboardId: id,
            title: widget.title,
            type: widget.type,
            metricKey: widget.metricKey,
            x: widget.x ?? 0,
            y: widget.y ?? 0,
            w: widget.w ?? 4,
            h: widget.h ?? 2,
            config: widget.config ?? undefined,
          })),
        });
      }

      return await tx.dashboardWidget.findMany({
        where: { dashboardId: id },
        orderBy: [{ y: "asc" }, { x: "asc" }],
      });
    });
  } catch (error) {
    console.error(`Error al actualizar widgets del tablero con ID ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// Métodos de Enlaces Compartidos (DashboardShare)
// ============================================================================

/**
 * Devuelve todos los enlaces compartidos con información del tablero, sección y creador.
 */
export async function getShareLinks(): Promise<DashboardShareWithDetails[]> {
  try {
    return await prisma.dashboardShare.findMany({
      include: {
        dashboard: {
          include: {
            section: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("Error al obtener los enlaces compartidos:", error);
    throw error;
  }
}

/**
 * Crea un enlace compartido para un tablero generando un UUID único en DashboardShare.
 */
export async function createShareLink(
  dashboardId: string,
  name: string,
  userId: number
): Promise<DashboardShare> {
  try {
    const token = randomUUID();
    return await prisma.dashboardShare.create({
      data: {
        id: token,
        name,
        dashboardId,
        createdById: userId,
        isActive: true,
      },
    });
  } catch (error) {
    console.error(
      `Error al crear enlace compartido para el tablero con ID ${dashboardId}:`,
      error
    );
    throw error;
  }
}

/**
 * Activa o desactiva un enlace compartido.
 */
export async function toggleShareLinkActive(
  id: string,
  isActive: boolean
): Promise<DashboardShare> {
  try {
    return await prisma.dashboardShare.update({
      where: { id },
      data: { isActive },
    });
  } catch (error) {
    console.error(`Error al cambiar estado del enlace compartido ${id}:`, error);
    throw error;
  }
}

/**
 * Elimina uno o más enlaces compartidos.
 */
export async function deleteShareLinks(ids: string[]): Promise<number> {
  try {
    const res = await prisma.dashboardShare.deleteMany({
      where: { id: { in: ids } },
    });
    return res.count;
  } catch (error) {
    console.error("Error al eliminar enlaces compartidos:", error);
    throw error;
  }
}

// ============================================================================
// Métodos para Selectores de Permisos (Roles y Usuarios)
// ============================================================================

export interface RoleOption {
  id: number;
  name: string;
  description: string | null;
}

export interface UserOption {
  id: number;
  username: string;
  email: string | null;
  fullName: string;
}

/**
 * Obtiene todos los roles disponibles para configurar permisos.
 */
export async function getRolesForAccess(): Promise<RoleOption[]> {
  try {
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    return roles;
  } catch (error) {
    console.error("Error al obtener roles:", error);
    return [];
  }
}

/**
 * Obtiene los usuarios activos disponibles para asignar acceso directo.
 */
export async function getUsersForAccess(): Promise<UserOption[]> {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        username: true,
        email: true,
        employee: {
          select: {
            firstName: true,
            paternalLastName: true,
          },
        },
      },
      orderBy: {
        username: "asc",
      },
    });

    return users.map((u) => {
      const fn = u.employee?.firstName || "";
      const ln = u.employee?.paternalLastName || "";
      const fullName = `${fn} ${ln}`.trim() || u.username;
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        fullName,
      };
    });
  } catch (error) {
    console.error("Error al obtener usuarios para accesos:", error);
    return [];
  }
}

// ============================================================================
// Compatibilidad con Dashboard Contable (Accounting / Resumen Financiero)
// ============================================================================

import { getJson, ApiError } from "./http";
import type { DashboardPayload } from "@/lib/accounting/dashboard";

export type {
  DashboardPayload,
  ExpenseCategory,
  Kpi,
  KpiKey,
  MonthlyPoint,
  TopAccount,
  Variation,
} from "@/lib/accounting/dashboard";

export { ApiError } from "./http";
export { formatCutOffDate, formatPen } from "./balance-sheet.service";

const ACCOUNTING_BASE_URL = "/api/accounting/dashboard";

/** Serializa el rango a query string (`desde`/`hasta`, YYYY-MM-DD). */
export function buildDashboardQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  params.set("desde", from);
  params.set("hasta", to);
  return params.toString();
}

/** Obtiene el payload del dashboard contable para el rango dado. */
export async function getDashboard(
  from: string,
  to: string
): Promise<DashboardPayload> {
  const query = buildDashboardQuery(from, to);
  return getJson<DashboardPayload>(`${ACCOUNTING_BASE_URL}?${query}`);
}
