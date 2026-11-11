import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { getDashboardCatalogService } from "@/lib/services/settings/dashboard-catalog.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboards/catalog
 * 
 * Devuelve el catálogo semántico serializable de datasets y campos visibles,
 * filtrando los datasets según los permisos RBAC del usuario conectado.
 */
export const GET = createApiHandler({
  permission: "tableros.ver",
  handler: async ({ session, superuser }) => {
    const data = await getDashboardCatalogService({
      userId: session?.userId,
      superuser,
    });
    return NextResponse.json({ success: true, data });
  },
});
