import { jwtVerify, SignJWT } from "jose";

/** Nombre de la cookie de sesión (httpOnly, firmada con HS256). */
export const SESSION_COOKIE = "sesion";
const DURATION_SECONDS = 60 * 60 * 8;

export interface SessionPayload {
  userId: number;
  username: string;
  role: string;
}

/** El secreto se lee al usarlo (no al importar) para no romper el build sin .env. */
function key(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
      ? process.env.SESSION_SECRET
      : "polleria_jwt_session_secret_production_key_32_chars_min";
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(`${DURATION_SECONDS}s`)
    .sign(key());
}

/** Devuelve el payload si el token es válido y no expiró; `null` en otro caso. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
    return {
      userId,
      username: String(payload.username ?? ""),
      role: String(payload.role ?? payload.rol ?? ""),
    };
  } catch {
    return null;
  }
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURATION_SECONDS,
};