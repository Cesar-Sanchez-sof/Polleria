import { NextResponse } from "next/server";
import { createApiHandler, ForbiddenError, ValidationError } from "@/lib/http/route-handler";
import { getDashboardAccess } from "@/lib/services/dashboards/dashboard-access.service";
import { getWidgetById } from "@/lib/services/dashboards/dashboard-widget.service";
import { executeDashboardQueryService } from "@/lib/services/settings/dashboard-query.service";
import { widgetDataConfigSchema } from "@/lib/dashboards/widget-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboards/[id]/widgets/[widgetId]/data
 *
 * Endpoint seguro para modo share: autentica, verifica acceso al dashboard,
 * lee la configuración del widget desde la BD (no del cliente) y ejecuta la consulta.
 */
export const GET = createApiHandler({
  requireAuth: true,
  handler: async ({ session, params }) => {
    const { id: dashboardId, widgetId } = params as Record<string, string>;

    // 1. Verificar acceso al dashboard
    const access = await getDashboardAccess(session!.userId, dashboardId);
    if (!access.canView) {
      throw new ForbiddenError("No tienes permiso para ver este tablero");
    }

    // 2. Obtener widget de la BD (verifica que pertenece al dashboard)
    const widget = await getWidgetById(widgetId, dashboardId);

    // 3. Parsear config del widget desde la BD
    const rawConfig = widget.config as Record<string, unknown> | null;
    // El config puede estar en rawConfig.data (si se guardó como { data: {...} }) o directamente
    const configCandidate = rawConfig?.data ?? rawConfig;

    const parseResult = widgetDataConfigSchema.safeParse(configCandidate);
    if (!parseResult.success) {
      throw new ValidationError(
        "El widget no tiene una configuración de datos válida: " +
          (parseResult.error.issues[0]?.message ?? "configuración inválida")
      );
    }

    // 4. Ejecutar consulta (el servicio verifica permisos del dataset internamente)
    const data = await executeDashboardQueryService(parseResult.data, {
      userId: session!.userId,
      superuser: false,
    });

    return NextResponse.json({ success: true, data });
  },
});
