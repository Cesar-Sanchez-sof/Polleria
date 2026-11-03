import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import { createSireGuard, parseSireQuery, consultPurchases, SireError, SIRE_MESSAGES } from "@/lib/sire/purchases";

export const dynamic = "force-dynamic";
// Token + ticket + descarga: la espera interna (40 s) queda por debajo del límite de la función.
export const maxDuration = 60;

const MAX_BODY_BYTES = 4 * 1024;
const NO_STORE = { "Cache-Control": "no-store" } as const;
/** 6 consultas por minuto y usuario; tras un rechazo de credenciales, 60 s de pausa (protege la clave SOL). */
const guard = createSireGuard({ max: 6, windowMs: 60_000, lockMs: 60_000 });

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/**
 * @openapi
 * /api/sire/purchases:
 *   post:
 *     tags:
 *       - SIRE
 *     summary: Query purchase vouchers (RCE proposal) registered in SUNAT
 *     description: >-
 *       Read-only. With the taxpayer's SOL and SUNAT API credentials (sent in the body, never stored or logged)
 *       asks SUNAT SIRE for the RCE proposal of a period and returns the invoices, receipts and other vouchers
 *       listed there. If SUNAT is still generating the file it answers `status=pending` with a `ticket` to send
 *       again. Nothing is sent or modified in SUNAT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ruc, usuarioSol, claveSol, clientId, clientSecret, anio, mes]
 *             properties:
 *               ruc: { type: string, example: "20123456789" }
 *               usuarioSol: { type: string }
 *               claveSol: { type: string, format: password }
 *               clientId: { type: string }
 *               clientSecret: { type: string, format: password }
 *               anio: { type: integer }
 *               mes: { type: integer, minimum: 1, maximum: 12 }
 *               ticket: { type: string, description: "Ticket of a previous request that was still pending." }
 *     responses:
 *       200:
 *         description: Vouchers (`status=ready`) or a pending ticket (`status=pending`).
 *       400:
 *         description: Invalid request.
 *       401:
 *         description: Not authenticated, or SUNAT rejected the credentials.
 *       403:
 *         description: Missing permission.
 *       429:
 *         description: Too many requests, or paused after rejected credentials.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("ple.ver");
  if (!auth.ok) return auth.response;

  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail(415, "El contenido debe ser application/json.");
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, "La solicitud es demasiado grande.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Solicitud no válida.");
  }
  const parsed = parseSireQuery(body);
  if (!parsed.ok) return fail(400, parsed.error);

  const blocked = guard.check(auth.session.userId);
  if (blocked === "locked") {
    return fail(429, "Espera un minuto antes de volver a intentar: SUNAT rechazó las credenciales y varios intentos pueden bloquear la clave SOL.");
  }
  if (blocked === "rate") return fail(429, "Demasiadas consultas seguidas. Espera un minuto.");

  try {
    const outcome = await consultPurchases(parsed.value);
    return Response.json(outcome, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof SireError) {
      if (error.kind === "credentials") guard.credentialsRejected(auth.session.userId);
      return fail(error.status, error.message);
    }
    // Sin `error` en el log: podría arrastrar datos de la petición.
    console.error("[api/sire/purchases] consulta fallida");
    return fail(500, SIRE_MESSAGES.unavailable);
  }
}
