"use server";

import { revalidatePath } from "next/cache";
import {
  createSection,
  updateSection,
  reorderSections,
  deleteSections,
  createDashboard,
  updateDashboard,
  toggleDashboardPublished,
  deleteDashboards,
  duplicateDashboard,
  createShareLink,
  toggleShareLinkActive,
  deleteShareLinks,
  type CreateDashboardData,
  type UpdateDashboardData,
} from "@/lib/services/dashboard.service";

// ============================================================================
// Server Actions para Secciones
// ============================================================================

export async function createSectionAction(name: string, order?: number) {
  try {
    const section = await createSection(name, order);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/secciones");
    return { success: true, data: section };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear sección" };
  }
}

export async function updateSectionAction(id: string, name: string) {
  try {
    const section = await updateSection(id, name);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/secciones");
    return { success: true, data: section };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar sección" };
  }
}

export async function reorderSectionsAction(
  sectionOrders: { id: string; order: number }[]
) {
  try {
    await reorderSections(sectionOrders);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/secciones");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al reordenar secciones" };
  }
}

export async function deleteSectionsAction(ids: string[]) {
  try {
    const count = await deleteSections(ids);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/secciones");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al eliminar secciones" };
  }
}

// ============================================================================
// Server Actions para Tableros
// ============================================================================

export async function createDashboardAction(data: CreateDashboardData) {
  try {
    const dashboard = await createDashboard(data);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/tableros");
    return { success: true, data: dashboard };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear tablero" };
  }
}

export async function updateDashboardAction(id: string, data: UpdateDashboardData) {
  try {
    const dashboard = await updateDashboard(id, data);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/tableros");
    return { success: true, data: dashboard };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar tablero" };
  }
}

export async function toggleDashboardPublishedAction(
  id: string,
  isPublished: boolean
) {
  try {
    const dashboard = await toggleDashboardPublished(id, isPublished);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/tableros");
    return { success: true, data: dashboard };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cambiar estado" };
  }
}

export async function duplicateDashboardAction(id: string, userId: number = 1) {
  try {
    const duplicated = await duplicateDashboard(id, userId);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/tableros");
    return { success: true, data: duplicated };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al duplicar tablero" };
  }
}

export async function deleteDashboardsAction(ids: string[]) {
  try {
    const count = await deleteDashboards(ids);
    revalidatePath("/dashboards");
    revalidatePath("/dashboards/config/tableros");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al eliminar tableros" };
  }
}

// ============================================================================
// Server Actions para Enlaces Compartidos
// ============================================================================

export async function createShareLinkAction(
  dashboardId: string,
  name: string,
  userId: number = 1
) {
  try {
    const link = await createShareLink(dashboardId, name, userId);
    revalidatePath("/dashboards/config/enlaces");
    return { success: true, data: link };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear enlace" };
  }
}

export async function toggleShareLinkActiveAction(id: string, isActive: boolean) {
  try {
    const link = await toggleShareLinkActive(id, isActive);
    revalidatePath("/dashboards/config/enlaces");
    return { success: true, data: link };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cambiar estado" };
  }
}

export async function deleteShareLinksAction(ids: string[]) {
  try {
    const count = await deleteShareLinks(ids);
    revalidatePath("/dashboards/config/enlaces");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al eliminar enlaces" };
  }
}
