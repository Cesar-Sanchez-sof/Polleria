import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { createOrderPreference } from "@/lib/services/integrations/mercadopago.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/mercadopago/preference:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Crear preferencia de pago o QR en Mercado Pago
 */

export const POST = createApiHandler<{ orderId?: number; order_id?: number; payerEmail?: string }>({
  permission: "ventas.crear",
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => ({}));
    const orderId = Number(rawBody?.orderId || rawBody?.order_id);
    const result = await createOrderPreference(orderId, rawBody?.payerEmail);
    return NextResponse.json(result, { status: 200 });
  },
});
