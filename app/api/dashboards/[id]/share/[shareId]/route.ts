import { NextResponse } from "next/server";
import { createApiHandler, ForbiddenError } from "@/lib/http/route-handler";
import { getDashboardAccess } from "@/lib/services/dashboards/dashboard-access.service";
import { deactivateShareLink } from "@/lib/services/dashboards/dashboard-share.service";

export const dynamic = "force-dynamic";

/** DELETE /api/dashboards/[id]/share/[shareId] — desactiva un share link (requiere canEdit) */
export const DELETE = createApiHandler({
  requireAuth: true,
  handler: async ({ session, params }) => {
    const { id: dashboardId, shareId } = params as Record<string, string>;
    const access = await getDashboardAccess(session!.userId, dashboardId);
    if (!access.canEdit) throw new ForbiddenError("No tienes permiso para revocar este enlace");

    await deactivateShareLink(shareId, session!.userId);
    return NextResponse.json({ success: true });
  },
});
