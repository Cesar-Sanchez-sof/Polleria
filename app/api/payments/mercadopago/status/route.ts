import { NextResponse } from "next/server";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import { syncOrderPaymentStatus } from "@/lib/services/integrations/mercadopago.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/mercadopago/status:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Consultar y sincronizar estado de pago en Mercado Pago
 *     description: Consulta a Mercado Pago si una comanda fue pagada. Si está aprobada, cierra el pedido, libera la mesa y emite el comprobante automáticamente.
 *     parameters:
 *       - in: query
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: paymentId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: simulate
 *         required: false
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Estado verificado y sincronizado.
 */
export const GET = createApiHandler({
  permission: "ventas.ver",
  handler: async ({ searchParams }) => {
    const orderIdParam = searchParams.get("orderId") || searchParams.get("id_pedido");
    const paymentId = searchParams.get("paymentId") || undefined;
    const simulate = searchParams.get("simulate") === "true";

    const orderId = Number(orderIdParam);
    if (!orderId || Number.isNaN(orderId)) {
      throw new ValidationError("Debe ingresar un orderId válido.");
    }

    const result = await syncOrderPaymentStatus(orderId, { paymentId, simulate });
    return NextResponse.json(result, { status: 200 });
  },
});
