import { NextResponse } from "next/server";
import { createApiHandler, ForbiddenError, ValidationError } from "@/lib/http/route-handler";
import { getDashboardAccess } from "@/lib/services/dashboards/dashboard-access.service";
import {
  listShareLinks,
  getOrCreateShareLink,
  getDashboardAccessList,
  setDashboardAccess,
  removeDashboardAccess,
  type AccessEntry,
} from "@/lib/services/dashboards/dashboard-share.service";

export const dynamic = "force-dynamic";

/** GET /api/dashboards/[id]/share — lista shares + lista de acceso (requiere canEdit) */
export const GET = createApiHandler({
  requireAuth: true,
  handler: async ({ session, params }) => {
    const dashboardId = String((params as Record<string, string>).id);
    const access = await getDashboardAccess(session!.userId, dashboardId);
    if (!access.canEdit) throw new ForbiddenError("No tienes permiso para gestionar este tablero");

    const [shares, accessList] = await Promise.all([
      listShareLinks(dashboardId),
      getDashboardAccessList(dashboardId),
    ]);
    return NextResponse.json({ success: true, data: { shares, accessList } });
  },
});

/** POST /api/dashboards/[id]/share — crea/obtiene share activo (requiere canEdit) */
export const POST = createApiHandler({
  requireAuth: true,
  handler: async ({ session, params, body }) => {
    const dashboardId = String((params as Record<string, string>).id);
    const access = await getDashboardAccess(session!.userId, dashboardId);
    if (!access.canEdit) throw new ForbiddenError("No tienes permiso para compartir este tablero");

    const rawBody = body as Record<string, unknown> | null;
    const name = String(rawBody?.name ?? "Enlace compartido");
    const share = await getOrCreateShareLink(dashboardId, session!.userId, name);
    return NextResponse.json({ success: true, data: share }, { status: 201 });
  },
});

/** PATCH /api/dashboards/[id]/share — gestiona acceso de roles/usuarios (requiere canEdit) */
export const PATCH = createApiHandler({
  requireAuth: true,
  handler: async ({ session, params, body }) => {
    const dashboardId = String((params as Record<string, string>).id);
    const access = await getDashboardAccess(session!.userId, dashboardId);
    if (!access.canEdit) throw new ForbiddenError("No tienes permiso para gestionar acceso");

    const rawBody = body as { entries?: AccessEntry[]; remove?: { type: "role" | "user"; id: number } } | null;

    if (rawBody?.entries) {
      await setDashboardAccess(dashboardId, rawBody.entries);
    } else if (rawBody?.remove) {
      await removeDashboardAccess(dashboardId, rawBody.remove);
    } else {
      throw new ValidationError("Se requiere 'entries' o 'remove'");
    }

    return NextResponse.json({ success: true });
  },
});
