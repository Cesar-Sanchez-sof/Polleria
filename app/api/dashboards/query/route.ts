import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { ValidationError } from "@/lib/http/errors";
import { widgetDataConfigSchema } from "@/lib/dashboards/widget-schema";
import { executeDashboardQueryService } from "@/lib/services/settings/dashboard-query.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/dashboards/query
 * 
 * Endpoint genérico para ejecutar consultas analíticas estilo Power BI
 * basadas en la capa semántica de datos.
 * Exige permiso base 'tableros.ver', y evalúa el permiso específico del dataset (ej. 'asientos.ver' para contabilidad).
 */
export const POST = createApiHandler({
  permission: "tableros.ver",
  handler: async ({ body, req, session, superuser }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => null);

    if (!rawBody || typeof rawBody !== "object") {
      throw new ValidationError("El cuerpo de la petición debe ser un objeto JSON válido.");
    }

    const parseResult = widgetDataConfigSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Configuración de consulta inválida.";
      throw new ValidationError(`Error de validación: ${firstError}`);
    }

    const data = await executeDashboardQueryService(parseResult.data, {
      userId: session?.userId,
      superuser,
    });
    return NextResponse.json({ success: true, data });
  },
});
