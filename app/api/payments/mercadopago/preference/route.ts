import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMercadoPagoPreference } from "@/lib/services/mercadopago.service";
import { autorizar } from "@/lib/auth/permisos";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/mercadopago/preference:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Crear preferencia de pago o QR en Mercado Pago
 *     description: Genera una preferencia oficial en Mercado Pago (Checkout Pro / QR) para que el comensal pague desde su celular.
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
 *         description: Preferencia creada exitosamente con URLs de pago y QR.
 */
export async function POST(request: NextRequest) {
  const auth = await autorizar("ventas.crear");
  if (!auth.ok) return auth.respuesta;
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = Number(body?.orderId || body?.id_pedido);

    if (!orderId || Number.isNaN(orderId)) {
      return Response.json({ error: "Debe proporcionar un ID de pedido válido." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { dish: true } },
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

    const items = order.items.map((it) => ({
      title: it.dish.name,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
    }));

    const result = await createMercadoPagoPreference({
      idPedido: order.id,
      codigoComanda: order.code,
      monto: roundedTotal,
      items,
      payerEmail: body?.payerEmail,
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
    console.error("[api/payments/mercadopago/preference] Error al crear preferencia:", error);
    return Response.json(
      { error: "No se pudo generar la preferencia de Mercado Pago.", detail: error.message },
      { status: 500 }
    );
  }
}
