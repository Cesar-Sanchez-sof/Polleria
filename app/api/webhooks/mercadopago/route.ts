import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature
} from "@/lib/services/mercadopago.service";
import { uploadVoucherToS3 } from "@/lib/services/s3-storage.service";
import { postSaleJournalEntries } from "@/lib/services/accounting-posting.service";

export const dynamic = "force-dynamic";

/**
 * Webhook Receptor de Notificaciones de Mercado Pago (IPN / Webhooks v2).
 *
 * Se activa automáticamente cuando:
 * 1. Un pago presencial (Tap to Pay o Point) es aprobado en el celular del mozo.
 * 2. Un cliente completa el pago mediante QR.
 *
 * Funcionamiento idempotente:
 * - Valida el estado 'approved'.
 * - Si el pedido ya fue cerrado, responde 200 inmediatamente sin duplicar cobros.
 * - Registra comprobante, pago, cierra el pedido y libera la mesa en Neon PostgreSQL.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const paymentId =
      body?.data?.id ||
      searchParams.get("data.id") ||
      searchParams.get("id") ||
      body?.id;

    const eventType = body?.type || searchParams.get("topic") || body?.action;

    if (!paymentId) {
      return Response.json({ message: "Webhook recibido sin ID de pago." }, { status: 200 });
    }

    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    const signatureValidation = verifyMercadoPagoWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataId: String(paymentId),
    });

    if (!signatureValidation.isValid) {
      console.warn(`[Webhook MercadoPago] Firma rechazada: ${signatureValidation.reason}`);
      return Response.json(
        { error: "Firma de webhook inválida.", detail: signatureValidation.reason },
        { status: 401 }
      );
    }

    console.log(`[Webhook MercadoPago] Evento recibido: ${eventType}, Payment ID: ${paymentId}`);

    const mpPayment = await getMercadoPagoPayment(paymentId);

    if (!mpPayment || (mpPayment.status !== "approved" && mpPayment.status_detail !== "simulated_without_token")) {
      console.log(`[Webhook MercadoPago] El pago ${paymentId} aún no está aprobado (Estado: ${mpPayment?.status}).`);
      return Response.json({ message: "Pago no aprobado aún." }, { status: 200 });
    }

    const extRef = mpPayment.external_reference || body?.external_reference || "";
    let orderId: number | null = null;

    if (extRef && extRef.startsWith("PED-")) {
      orderId = Number(extRef.replace("PED-", ""));
    } else if (!Number.isNaN(Number(extRef))) {
      orderId = Number(extRef);
    }

    if (!orderId) {
      return Response.json({ message: "Pago verificado sin pedido asociado directo." }, { status: 200 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        tables: { include: { table: true } },
        items: true,
      },
    });

    if (!order) {
      return Response.json({ error: `Pedido ${orderId} no encontrado.` }, { status: 200 });
    }

    if (order.status === "Closed") {
      return Response.json({ message: "El pedido ya se encontraba cerrado." }, { status: 200 });
    }

    const cardPaymentType = await prisma.paymentType.findFirst({
      where: {
        OR: [
          { name: { contains: "POS", mode: "insensitive" } },
          { name: { contains: "Tarjeta", mode: "insensitive" } },
        ],
      },
    });

    const paymentTypeId = cardPaymentType ? cardPaymentType.id : 1;

    const total = order.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
    const roundedTotal = Math.round(total * 100) / 100;
    const subtotal = Math.round((roundedTotal / 1.18) * 100) / 100;
    const igv = Math.round((roundedTotal - subtotal) * 100) / 100;

    const generalCustomer = await prisma.customer.findFirst({
      where: { documentNumber: "00000000" },
    });

    const customerId = generalCustomer?.id || 1;

    const series = "B001";
    const lastInvoice = await prisma.salesInvoice.findFirst({
      where: { series },
      orderBy: { number: "desc" },
    });
    const sequentialNumber = (lastInvoice?.number ?? 0) + 1;

    let createdInvoiceId: number | null = null;

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.create({
        data: {
          orderId: order.id,
          customerId,
          voucherType: "Boleta",
          series,
          number: sequentialNumber,
          subtotal,
          igv,
          totalAmount: roundedTotal,
          status: "Issued",
          issuedAt: new Date(),
        },
      });

      createdInvoiceId = invoice.id;

      await tx.salesPayment.create({
        data: {
          salesInvoiceId: invoice.id,
          paymentTypeId,
          amount: roundedTotal,
          paidAt: new Date(),
        },
      });

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "Closed" },
      });

      if (order.tables.length > 0) {
        for (const pm of order.tables) {
          await tx.diningTable.update({
            where: { id: pm.tableId },
            data: { active: true },
          });
        }
      }

      await postSaleJournalEntries(tx, {
        salesInvoiceId: invoice.id,
        voucherCode: `${series}-${String(sequentialNumber).padStart(6, "0")}`,
        entryDate: invoice.issuedAt,
        subtotal,
        igv,
        total: roundedTotal,
        paymentMethodName: cardPaymentType?.name || "Tarjeta / POS",
        responsible: "Mercado Pago",
      });
    });

    if (createdInvoiceId) {
      await uploadVoucherToS3({
        idComprobante: createdInvoiceId,
        tipoComprobante: "Boleta",
        serie: series,
        numero: sequentialNumber,
        formato: "pdf",
        fecha: new Date(),
      }).catch((s3Err) => {
        console.warn("[Webhook MercadoPago] Advertencia al archivar en S3:", s3Err);
      });
    }

    console.log(`[Webhook MercadoPago] Pedido ${orderId} cerrado, mesa liberada y comprobante B001-${sequentialNumber} archivado en S3.`);
    return Response.json({ message: "Pago procesado, mesa liberada y comprobante archivado con éxito." }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Webhook MercadoPago] Error al procesar notificación:", error);
    return Response.json({ message: "Error registrado en servidor.", detail: message }, { status: 200 });
  }
}

/**
 * Handshake GET para verificación de URL en el Panel de Desarrolladores de Mercado Pago.
 */
export async function GET() {
  return Response.json({
    status: "active",
    service: "Webhook Mercado Pago - Pollería ERP",
    date: new Date().toISOString(),
  });
}
