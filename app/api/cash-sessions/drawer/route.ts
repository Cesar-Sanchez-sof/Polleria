import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { openDrawerNoSale } from "@/lib/services/sales/cash-sessions.service";
import { recentDrawerEvents, resolveDrawerTarget } from "@/lib/services/integrations/cash-drawer.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions/drawer:
 *   get:
 *     tags:
 *       - CashRegister
 *     summary: Estado de la integración con la caja registradora física y últimos eventos simulados
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Abrir la gaveta sin venta (body { reason }); queda en auditoría
 */

export const GET = createApiHandler({
  permission: "caja.ver",
  handler: async () => {
    const target = await resolveDrawerTarget();
    return NextResponse.json({
      mode: target.mode,
      target: target.host ? `${target.host}:${target.port}` : null,
      paperColumns: target.width,
      recentEvents: target.mode === "simulated" ? recentDrawerEvents() : [],
    });
  },
});

export const POST = createApiHandler<{ reason?: string }>({
  permission: "caja.crear",
  handler: async ({ body, session, req }) => {
    const raw = body !== undefined ? body : await req.json().catch(() => ({}));
    const result = await openDrawerNoSale(raw ?? {}, {
      userId: session?.userId ?? null,
      username: session?.username ?? "sistema",
    });
    return NextResponse.json(result);
  },
});
