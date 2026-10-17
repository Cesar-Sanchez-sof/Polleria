import { currentSession } from "@/lib/auth/current-session";
import type { AuditActor } from "@/lib/services/audit.service";

/** Usuario de la petición para la bitácora; `null` si no hay sesión (nunca lanza). */
export async function currentActor(): Promise<AuditActor | null> {
  try {
    const s = await currentSession();
    return s ? { userId: s.userId, username: s.username } : null;
  } catch {
    return null;
  }
}