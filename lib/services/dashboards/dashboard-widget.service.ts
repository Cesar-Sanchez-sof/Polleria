import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/http/errors";
import type { DashboardWidget } from "@prisma/client";

export type { DashboardWidget };

/**
 * Obtiene un widget verificando que pertenezca al dashboard indicado.
 * Lanza NotFoundError si no existe o no pertenece al dashboard.
 */
export async function getWidgetById(
  widgetId: string,
  dashboardId: string
): Promise<DashboardWidget> {
  const widget = await prisma.dashboardWidget.findFirst({
    where: { id: widgetId, dashboardId },
  });
  if (!widget) throw new NotFoundError("Widget no encontrado en este tablero");
  return widget;
}
