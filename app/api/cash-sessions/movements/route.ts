import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  listCashMovements,
  createCashMovement,
  type CreateCashMovementInput,
} from "@/lib/services/cash-sessions.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions/movements:
 *   get:
 *     tags:
 *       - CashRegister
 *     summary: Listar movimientos y salidas de caja de una sesión
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Registrar una salida de dinero por emergencia o gasto menor con asiento contable
 */

export const GET = createApiHandler({
  permission: "caja.ver",
  handler: async ({ searchParams }) => {
    const sessionIdParam = searchParams.get("sessionId");
    const sessionId = Number(sessionIdParam);
    const movements = await listCashMovements(sessionId);
    return NextResponse.json({ movements });
  },
});

export const POST = createApiHandler<CreateCashMovementInput>({
  permission: "caja.crear",
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => ({}));
    const result = await createCashMovement(rawBody);
    return NextResponse.json(result, { status: 201 });
  },
});
