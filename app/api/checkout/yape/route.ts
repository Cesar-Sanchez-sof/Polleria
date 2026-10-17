import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestaurantGlobalConfig } from "@/lib/services/restaurant-config.service";
import { processMercadoPagoPaymentApproval } from "@/lib/services/mercadopago.service";

export const dynamic = "force-dynamic";

/**
 * Endpoint público para la vista de cobro / simulación de Yape (escaneado por comensal o mozo).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = Number(searchParams.get("orderId"));

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json({ error: "Debe proporcionar un ID de pedido válido." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        tables: { include: { table: true } },
        items: { include: { product: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: `El pedido #${orderId} no fue encontrado.` }, { status: 404 });
    }

    const config = getRestaurantGlobalConfig();
    const phone = config.restaurant.yapePhone || config.restaurant.phone || "954316272";
    const phoneClean = phone.replace(/\D/g, "").slice(-9);
    const phoneDisplay = phoneClean.length === 9
      ? phoneClean.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
      : phoneClean;
    const merchantName = config.restaurant.yapeName || config.restaurant.commercialName || config.restaurant.name || "POLLERIA";

    const total = order.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
    const roundedTotal = Math.round(total * 100) / 100;

    const tableNumbers = order.tables.map((t) => t.table.number);
    const tableName = tableNumbers.length > 0 ? `Mesa ${tableNumbers.join(", ")}` : "Para Llevar";

    // Si ya está pagado, obtener comprobante
    let existingInvoice = null;
    if (order.status === "Closed") {
      const inv = await prisma.salesInvoice.findFirst({
        where: { orderId: order.id },
        orderBy: { id: "desc" },
      });
      if (inv) {
        existingInvoice = {
          fullCode: `${inv.series}-${String(inv.number).padStart(6, "0")}`,
          total: Number(inv.totalAmount),
          issuedAt: inv.issuedAt,
        };
      }
    }

    return NextResponse.json({
      orderId: order.id,
      code: order.code,
      status: order.status,
      tableName,
      total: roundedTotal,
      merchantName,
      phoneClean,
      phoneDisplay,
      yapeQrImageUrl: config.restaurant.yapeQrImageUrl || "",
      existingInvoice,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.product.name,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        subtotal: Number(it.subtotal),
      })),
    });
  } catch (error: any) {
    console.error("[api/checkout/yape] Error al consultar datos de comanda:", error);
    return NextResponse.json({ error: error.message || "Error al consultar comanda." }, { status: 500 });
  }
}

/**
 * Procesa la simulación de cobro de Yape desde el celular o navegador,
 * grabando el pago en la base de datos de la pollería.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = Number(body?.orderId);

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: `Pedido #${orderId} no encontrado.` }, { status: 404 });
    }

    if (order.status === "Closed") {
      const existingInv = await prisma.salesInvoice.findFirst({
        where: { orderId: order.id },
        orderBy: { id: "desc" },
      });

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: "El pedido ya fue pagado y cerrado previamente.",
        invoice: existingInv
          ? {
              fullCode: `${existingInv.series}-${String(existingInv.number).padStart(6, "0")}`,
              total: Number(existingInv.totalAmount),
            }
          : undefined,
      });
    }

    const paymentId = `YAPE-DIRECT-${Date.now()}-${order.id}`;

    // Procesar aprobación atómica en PostgreSQL
    const result = await processMercadoPagoPaymentApproval(paymentId, order.id, {
      paymentMethodName: "Yape Directo",
      voucherType: body?.voucherType || "Boleta",
      customerDoc: body?.customerDoc,
      customerName: body?.customerName,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId,
      message: `¡Pago con Yape confirmado con éxito! Se emitió el comprobante ${result.invoice?.fullCode || ""} y se liberó la mesa.`,
      invoice: result.invoice,
    });
  } catch (error: any) {
    console.error("[api/checkout/yape] Error al procesar pago simulado:", error);
    return NextResponse.json({ error: error.message || "Error al procesar pago simulado." }, { status: 500 });
  }
}
