import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion, type PayloadSesion } from "@/lib/auth/session";
import { usuarioActivo } from "@/lib/services/usuarios.service";

/** Sesión de la petición actual; `null` si no hay cookie válida o el usuario fue desactivado. */
export async function sesionActual(): Promise<PayloadSesion | null> {
  const jar = await cookies();
  const sesion = await verificarSesion(jar.get(COOKIE_SESION)?.value);
  if (!sesion || !(await usuarioActivo(sesion.idUsuario))) return null;
  return sesion;
}