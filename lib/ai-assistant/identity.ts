/**
 * P-9: aserción de identidad que el proxy firma para `ai-service` (SOLO servidor).
 *
 * La identidad sale exclusivamente de `sesionActual()` (cookie verificada y usuario activo); el rol
 * es el del asistente, derivado en el servidor. JWT HS256 de vida corta (60 s) ligado a la traza:
 * `ai-service` verifica firma, algoritmo, emisor, destinatario, vigencia y coincidencia con la
 * solicitud antes de crear cualquier contexto de autorización.
 */
import { SignJWT } from "jose";

export const IDENTITY_HEADER = "X-ERP-Identity";
export const IDENTITY_ISSUER = "polleria-erp";
export const IDENTITY_AUDIENCE = "ai-service";
export const IDENTITY_TTL_SECONDS = 60;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function signIdentity(
  keyHex: string,
  identity: { userId: number; rol: string; traceId: string },
  now: Date,
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ rol: identity.rol })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(IDENTITY_ISSUER)
    .setAudience(IDENTITY_AUDIENCE)
    .setSubject(String(identity.userId))
    .setJti(identity.traceId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + IDENTITY_TTL_SECONDS)
    .sign(hexToBytes(keyHex));
}
