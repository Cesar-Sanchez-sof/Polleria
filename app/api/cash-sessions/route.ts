import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  getCashSessionState,
  openCashSession,
  type OpenCashSessionInput,
} from "@/lib/services/sales/cash-sessions.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions:
 *   get:
 *     tags:
 *       - CashRegister
 *     summary: Obtener estado de la caja y sesión activa con movimientos
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Abrir una nueva sesión de caja con arqueo inicial y asiento contable
 */

export const GET = createApiHandler({
  permission: "caja.ver",
  handler: async () => {
    const state = await getCashSessionState();
    return NextResponse.json(state);
  },
});

export const POST = createApiHandler<OpenCashSessionInput>({
  permission: "caja.crear",
  handler: async ({ body, session, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => ({}));
    const result = await openCashSession({
      ...rawBody,
      userId: session?.userId,
    });
    return NextResponse.json(result, { status: 201 });
  },
});
