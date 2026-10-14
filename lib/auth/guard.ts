import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/auth/sesion-actual";
import type { PayloadSesion } from "@/lib/auth/session";
import { permisosDeUsuario, tienePermiso } from "@/lib/auth/permisos";

/**
 * ISO/IEC 27001:2022 - Controles A.5.15 y A.8.3
 * Control de Acceso y Restricción de Acceso a la Información (Defense in Depth).
 * Exige una sesión activa y validada contra base de datos (usuario activo).
 * Si la sesión no existe, expiró o el usuario fue desactivado, redirige de inmediato a /login.
 */
export async function exigirSesionServidor(rolRequerido?: string): Promise<PayloadSesion> {
  const sesion = await sesionActual().catch(() => null);
  if (!sesion) {
    redirect("/login");
  }
  if (rolRequerido && sesion.rol !== rolRequerido && sesion.rol !== "ADMIN") {
    redirect("/login");
  }
  return sesion;
}

/**
 * Verifica si un rol tiene permisos suficientes para una operación (RBAC).
 * El rol ADMIN tiene acceso irrestricto de administración.
 */
export function tienePermisoRol(rolUsuario: string, rolesPermitidos: string[]): boolean {
  if (rolUsuario === "ADMIN") return true;
  return rolesPermitidos.includes(rolUsuario);
}
/**
 * ISO/IEC 27001:2022 - A.5.15 / A.8.3
 * Exige sesión activa y el permiso indicado (RBAC por permisos del rol).
 * Sin permiso, redirige al inicio sin ejecutar nada de la página.
 */
export async function exigirPermisoServidor(codigo: string): Promise<PayloadSesion> {
  const sesion = await exigirSesionServidor();
  const acceso = await permisosDeUsuario(sesion.idUsuario);
  if (!tienePermiso(acceso, codigo)) redirect("/");
  return sesion;
}