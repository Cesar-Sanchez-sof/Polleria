import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMercadoPagoYapePayment } from "@/lib/services/mercadopago.service";
import { getRestaurantGlobalConfig } from "@/lib/services/restaurant-config.service";
import { authorize } from "@/lib/auth/permissions";

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
export async function POST(request: NextRequest) {
  const auth = await authorize("ventas.crear");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = Number(body?.orderId || body?.order_id);

    if (!orderId || Number.isNaN(orderId)) {
      return Response.json(
        { error: "Debe proporcionar un ID de pedido válido." },
        { status: 400 }
      );
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      return Response.json({ error: `Pedido ${orderId} no encontrado.` }, { status: 404 });
    }

    if (order.status === "Closed") {
      return Response.json(
        { error: "El pedido ya fue pagado y cerrado anteriormente." },
        { status: 400 }
      );
    }

    const total = order.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
    const roundedTotal = Math.round(total * 100) / 100;

    const globalConfig = getRestaurantGlobalConfig();
    const phone =
      globalConfig.restaurant.yapePhone || globalConfig.restaurant.phone || "987654321";
    const merchantName =
      globalConfig.restaurant.yapeName ||
      globalConfig.restaurant.commercialName ||
      globalConfig.restaurant.name ||
      "POLLERIA REST";

    const result = await createMercadoPagoYapePayment({
      orderId: order.id,
      kitchenOrderCode: order.code,
      amount: roundedTotal,
      payerEmail: body?.payerEmail,
      phone,
      merchantName,
      city: globalConfig.restaurant.city || "Lima",
      otp: body?.otp,
      customerPhone: body?.customerPhone || body?.phone,
    });

    return Response.json(
      {
        success: true,
        orderId: order.id,
        orderCode: order.code,
        total: roundedTotal,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[api/payments/mercadopago/yape] Error al generar cobro Yape:", error);
    return Response.json(
      { error: "No se pudo generar el QR de Yape con Mercado Pago.", detail: error.message },
      { status: 500 }
    );
  }
}
