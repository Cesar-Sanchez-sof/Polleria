import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/current-session";
import type { SessionPayload } from "@/lib/auth/session";
import { permissionsForUser, hasPermission } from "@/lib/auth/permissions";

/**
 * ISO/IEC 27001:2022 - Controles A.5.15 y A.8.3
 * Control de Acceso y Restricción de Acceso a la Información (Defense in Depth).
 * Exige una sesión activa y validada contra base de datos (usuario activo).
 * Si la sesión no existe, expiró o el usuario fue desactivado, redirige de inmediato a /login.
 */
export async function requireServerSession(requiredRole?: string): Promise<SessionPayload> {
  const session = await currentSession().catch(() => null);
  if (!session) {
    redirect("/login");
  }
  if (requiredRole && session.role !== requiredRole && session.role !== "ADMIN") {
    redirect("/login");
  }
  return session;
}

/**
 * Verifica si un rol tiene permisos suficientes para una operación (RBAC).
 * El rol ADMIN tiene acceso irrestricto de administración.
 */
export function hasRolePermission(roleUser: string, allowedRoles: string[]): boolean {
  if (roleUser === "ADMIN") return true;
  return allowedRoles.includes(roleUser);
}
/**
 * ISO/IEC 27001:2022 - A.5.15 / A.8.3
 * Exige sesión activa y el permiso indicado (RBAC por permisos del rol).
 * Sin permiso, redirige al inicio sin ejecutar nada de la página.
 */
export async function requireServerPermission(code: string): Promise<SessionPayload> {
  const session = await requireServerSession();
  const access = await permissionsForUser(session.userId);
  if (!hasPermission(access, code)) redirect("/");
  return session;
}