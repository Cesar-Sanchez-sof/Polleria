import { NextResponse } from "next/server";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import { createOrderYapePayment } from "@/lib/services/mercadopago.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/mercadopago/yape:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Generar QR dinámico para Yape integrado con Mercado Pago
 *     description: Genera un cobro de Yape oficial o simulado con código QR dinámico EMVCo para que el comensal escanee con su app Yape y pague el monto exacto de la comanda.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: integer
 *               payerEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código QR y datos de pago de Yape generados exitosamente.
 */
export const POST = createApiHandler<{
  orderId?: number;
  order_id?: number;
  payerEmail?: string;
  otp?: string;
  customerPhone?: string;
  phone?: string;
}>({
  permission: "ventas.crear",
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => ({}));
    const orderId = Number(rawBody?.orderId || rawBody?.order_id);

    if (!orderId || Number.isNaN(orderId)) {
      throw new ValidationError("Debe proporcionar un ID de pedido válido.");
    }

    const result = await createOrderYapePayment(orderId, {
      payerEmail: rawBody?.payerEmail,
      otp: rawBody?.otp,
      customerPhone: rawBody?.customerPhone,
      phone: rawBody?.phone,
    });

    return NextResponse.json(result, { status: 200 });
  },
});
