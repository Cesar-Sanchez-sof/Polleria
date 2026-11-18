import { prisma } from "@/lib/prisma";

/**
 * Obtiene un DashboardShare con el dashboard (incluye widgets y sección).
 * Retorna null si no existe (nunca lanza NotFoundError — el caller decide qué hacer).
 */
export async function getShareWithDashboard(uuid: string) {
  return prisma.dashboardShare.findUnique({
    where: { id: uuid },
    include: {
      dashboard: {
        include: {
          widgets: true,
          section: true,
        },
      },
    },
  });
}
