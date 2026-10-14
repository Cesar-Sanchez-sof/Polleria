import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  searchMercadoPagoPaymentsByOrder,
  processMercadoPagoPaymentApproval,
} from "@/lib/services/mercadopago.service";
import { autorizar } from "@/lib/auth/permisos";

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

export async function GET(request: NextRequest) {
  const auth = await autorizar("ventas.ver");
  if (!auth.ok) return auth.respuesta;
  try {
    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get("orderId") || searchParams.get("id_pedido");
    const paymentIdParam = searchParams.get("paymentId");
    const simulate = searchParams.get("simulate") === "true";

    const orderId = Number(orderIdParam);
    if (!orderId || Number.isNaN(orderId)) {
      return Response.json({ error: "Debe ingresar un orderId válido." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        tables: { include: { table: true } },
        items: true,
      },
    });

    if (!order) {
      return Response.json({ error: `Pedido ${orderId} no encontrado.` }, { status: 404 });
    }

    // 1. Si el pedido ya está cerrado, responder directamente
    if (order.status === "Closed") {
      const invoice = await prisma.salesInvoice.findFirst({
        where: { orderId: order.id },
        orderBy: { id: "desc" },
      });

      return Response.json({
        success: true,
        orderId: order.id,
        status: "approved",
        alreadyProcessed: true,
        invoice: invoice
          ? {
              id: invoice.id,
              voucherType: invoice.voucherType,
              series: invoice.series,
              number: invoice.number,
              fullCode: `${invoice.series}-${String(invoice.number).padStart(6, "0")}`,
              totalAmount: Number(invoice.totalAmount),
            }
          : null,
        message: "El pedido ya se encuentra cobrado y cerrado.",
      });
    }

    // 2. Si se solicitó simulación de aprobación (pruebas de integración / entorno demo)
    if (simulate) {
      const simPaymentId = `MP-SIM-${Date.now()}`;
      const approval = await processMercadoPagoPaymentApproval(simPaymentId, order.id, {
        paymentMethodName: "Mercado Pago (Simulado)",
        voucherType: "Boleta",
      });

      return Response.json({
        success: approval.success,
        orderId: order.id,
        status: "approved",
        simulated: true,
        invoice: approval.invoice,
        message: approval.message,
      });
    }

    // 3. Consultar a la API oficial de Mercado Pago
    let paymentData: any = null;

    if (paymentIdParam) {
      paymentData = await getMercadoPagoPayment(paymentIdParam);
    } else {
      const results = await searchMercadoPagoPaymentsByOrder(order.id);
      if (results && results.length > 0) {
        paymentData = results[0];
      }
    }

    if (!paymentData) {
      return Response.json({
        success: true,
        orderId: order.id,
        status: "pending",
        message: "Aún no se registra ningún pago en Mercado Pago para esta comanda.",
      });
    }

    if (paymentData.status === "approved") {
      const approval = await processMercadoPagoPaymentApproval(
        paymentData.id || `MP-${Date.now()}`,
        order.id,
        {
          paymentMethodName: "Mercado Pago",
          voucherType: "Boleta",
        }
      );

      return Response.json({
        success: approval.success,
        orderId: order.id,
        status: "approved",
        paymentId: paymentData.id,
        invoice: approval.invoice,
        message: approval.message,
      });
    }

    return Response.json({
      success: true,
      orderId: order.id,
      status: paymentData.status || "pending",
      statusDetail: paymentData.status_detail,
      message: `El pago se encuentra en estado: ${paymentData.status}.`,
    });
  } catch (error: any) {
    console.error("[api/payments/mercadopago/status] Error al consultar estado:", error);
    return Response.json(
      { error: "Error al consultar estado en Mercado Pago.", detail: error.message },
      { status: 500 }
    );
  }
}
