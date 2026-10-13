import { jwtVerify, SignJWT } from "jose";

/** Nombre de la cookie de sesión (httpOnly, firmada con HS256). */
export const COOKIE_SESION = "sesion";
const DURACION_SEGUNDOS = 60 * 60 * 8;

export interface PayloadSesion {
  idUsuario: number;
  username: string;
  rol: string;
}

/** El secreto se lee al usarlo (no al importar) para no romper el build sin .env. */
function clave(): Uint8Array {
  const secreto =
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
      ? process.env.SESSION_SECRET
      : "polleria_jwt_session_secret_production_key_32_chars_min";
  return new TextEncoder().encode(secreto);
}

export async function firmarSesion(payload: PayloadSesion): Promise<string> {
  return new SignJWT({ username: payload.username, rol: payload.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.idUsuario))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(clave());
}

/** Devuelve el payload si el token es válido y no expiró; `null` en otro caso. */
export async function verificarSesion(token: string | undefined): Promise<PayloadSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    const idUsuario = Number(payload.sub);
    if (!Number.isInteger(idUsuario)) return null;
    return {
      idUsuario,
      username: String(payload.username ?? ""),
      rol: String(payload.rol ?? ""),
    };
  } catch {
    return null;
  }
}

export const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACION_SEGUNDOS,
};