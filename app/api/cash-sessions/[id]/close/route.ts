import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  closeCashSession,
  type CloseCashSessionInput,
} from "@/lib/services/cash-sessions.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions/{id}/close:
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Cerrar y arquear una sesión de caja con billetes/monedas y asientos contables
 */

export const POST = createApiHandler<CloseCashSessionInput, { id: string }>({
  permission: "caja.editar",
  handler: async ({ params, body, session, req }) => {
    const sessionId = Number(params?.id);
    const rawBody = body !== undefined ? body : await req.json().catch(() => ({}));
    const result = await closeCashSession(sessionId, {
      ...rawBody,
      userId: session?.userId,
    });
    return NextResponse.json(result, { status: 200 });
  },
});
