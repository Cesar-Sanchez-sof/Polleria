import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/auth/session";
import { activeUser } from "@/lib/services/users.service";

/** Sesión de la petición actual; `null` si no hay cookie válida o el usuario fue desactivado. */
export async function currentSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session || !(await activeUser(session.userId))) return null;
  return session;
}