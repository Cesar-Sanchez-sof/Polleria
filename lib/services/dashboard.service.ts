import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  Dashboard,
  DashboardSection,
  DashboardWidget,
  DashboardShare,
} from "@prisma/client";

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export interface CreateDashboardData {
  name: string;
  sectionId: string;
  accessGroups?: string[];
  allowedUsers?: string[];
  isPublished?: boolean;
  createdById: number;
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

export type DashboardWithWidgetsAndSection = Prisma.DashboardGetPayload<{
  include: {
    section: true;
    widgets: true;
  };
}>;

// ============================================================================
// Métodos del Módulo de Tableros (Dashboards)
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
 *
 * @param name Nombre representativo de la sección.
 * @param order Posición opcional para la ordenación.
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
 * Devuelve todos los tableros incluyendo los datos de su sección asociada.
 */
export async function getDashboards(): Promise<DashboardWithSection[]> {
  try {
    return await prisma.dashboard.findMany({
      include: {
        section: true,
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
 * Crea un nuevo tablero con su configuración inicial de permisos y sección.
 *
 * @param data Objeto con nombre, sectionId, accessGroups, allowedUsers, isPublished y createdById.
 */
export async function createDashboard(
  data: CreateDashboardData
): Promise<DashboardWithSection> {
  try {
    return await prisma.dashboard.create({
      data: {
        name: data.name,
        sectionId: data.sectionId,
        accessGroups: data.accessGroups ?? [],
        allowedUsers: data.allowedUsers ?? [],
        isPublished: data.isPublished ?? false,
        createdById: data.createdById,
      },
      include: {
        section: true,
      },
    });
  } catch (error) {
    console.error("Error al crear el tablero:", error);
    throw error;
  }
}

/**
 * Devuelve un tablero por su ID, incluyendo sus widgets ordenados por posición
 * (y: 'asc', x: 'asc') y la información de su sección.
 *
 * @param id Identificador único (UUID) del tablero.
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
      },
    });
  } catch (error) {
    console.error(`Error al obtener el tablero con ID ${id}:`, error);
    throw error;
  }
}

/**
 * Actualiza los widgets de un tablero de manera atómica (dentro de una transacción).
 * Elimina los widgets existentes del tablero y crea los nuevos datos proporcionados.
 *
 * @param id Identificador único (UUID) del tablero.
 * @param widgetsData Lista de widgets con sus posiciones, tipo, título y métrica.
 * @returns Lista de widgets actualizados y ordenados por su posición (y, x).
 */
export async function updateDashboardWidgets(
  id: string,
  widgetsData: DashboardWidgetInput[]
): Promise<DashboardWidget[]> {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Eliminar widgets existentes asignados al tablero
      await tx.dashboardWidget.deleteMany({
        where: { dashboardId: id },
      });

      // 2. Insertar los nuevos widgets si la lista no está vacía
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

      // 3. Devolver los widgets creados ordenados por posición
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

/**
 * Crea un enlace compartido para un tablero generando un UUID único en DashboardShare.
 *
 * @param dashboardId Identificador único del tablero a compartir.
 * @param name Nombre o etiqueta descriptiva para el enlace compartido.
 * @param userId ID numérico del usuario que genera el enlace.
 * @returns El registro de DashboardShare creado.
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
