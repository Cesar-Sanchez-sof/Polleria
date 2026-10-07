import { sesionActual } from "@/lib/auth/sesion-actual";
import type { ActorAuditoria } from "@/lib/services/audit.service";

/** Usuario de la petición para la bitácora; `null` si no hay sesión (nunca lanza). */
export async function actorActual(): Promise<ActorAuditoria | null> {
  try {
    const s = await sesionActual();
    return s ? { userId: s.idUsuario, username: s.username } : null;
  } catch {
    return null;
  }
}