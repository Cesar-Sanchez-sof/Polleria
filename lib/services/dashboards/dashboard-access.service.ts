import { prisma } from "@/lib/prisma";
import { permissionsForUser } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/http/errors";

/**
 * Calcula el nivel de acceso de un usuario a un dashboard dado.
 * Precedencia:
 *  1. Superuser (role.isSystem) → canView + canEdit
 *  2. Creator (Dashboard.createdById === userId) → canView + canEdit
 *  3. DashboardUserAccess (si existe, se usa y NO se combina con RoleAccess)
 *  4. DashboardRoleAccess (roleId del usuario)
 *  5. Sin acceso → { canView: false, canEdit: false }
 *
 * Reglas adicionales:
 * - canEdit siempre implica canView.
 * - Si isPublished === false, solo quienes canEdit pueden ver (canView se sobreescribe a false
 *   cuando canEdit es false).
 */
export async function getDashboardAccess(
  userId: number,
  dashboardId: string
): Promise<{ canView: boolean; canEdit: boolean }> {
  // Fetch dashboard and user role in parallel
  const [dashboard, user, access] = await Promise.all([
    prisma.dashboard.findUnique({
      where: { id: dashboardId },
      select: { createdById: true, isPublished: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    }),
    permissionsForUser(userId),
  ]);

  if (!dashboard) {
    throw new NotFoundError("Dashboard no encontrado");
  }

  let canView = false;
  let canEdit = false;

  // 1. Superuser
  if (access.superuser) {
    canView = true;
    canEdit = true;
  }
  // 2. Creator
  else if (dashboard.createdById === userId) {
    canView = true;
    canEdit = true;
  } else {
    // 3. DashboardUserAccess — takes precedence over RoleAccess
    const userAccess = await prisma.dashboardUserAccess.findUnique({
      where: { dashboardId_userId: { dashboardId, userId } },
      select: { canView: true, canEdit: true },
    });

    if (userAccess) {
      canView = userAccess.canView;
      canEdit = userAccess.canEdit;
    } else if (user?.roleId != null) {
      // 4. DashboardRoleAccess for the user's role
      const roleAccess = await prisma.dashboardRoleAccess.findUnique({
        where: { dashboardId_roleId: { dashboardId, roleId: user.roleId } },
        select: { canView: true, canEdit: true },
      });

      if (roleAccess) {
        canView = roleAccess.canView;
        canEdit = roleAccess.canEdit;
      }
      // 5. No access record → both remain false
    }
  }

  // canEdit always implies canView
  if (canEdit) {
    canView = true;
  }

  // If not published, only editors can view
  if (!dashboard.isPublished && !canEdit) {
    canView = false;
  }

  return { canView, canEdit };
}
