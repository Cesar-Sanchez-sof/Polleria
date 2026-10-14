import { NextRequest } from "next/server";
import {
  getMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
  processMercadoPagoPaymentApproval,
} from "@/lib/services/mercadopago.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/webhooks/mercadopago:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Recepcionar notificaciones de Mercado Pago (IPN / Webhook v2)
 *     description: Notificación automática que se ejecuta cuando un pago de Mercado Pago (QR, Checkout o Tap to Pay) es procesado.
 *     responses:
 *       200:
 *         description: Notificación recibida y procesada correctamente.
 *       401:
 *         description: Firma de webhook inválida.
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Handshake de verificación de URL de webhook
 *     responses:
 *       200:
 *         description: Confirmación de webhook activo.
 */

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    // El ID del pago puede venir en body.data.id, searchParams o body.id
    const paymentId =
      body?.data?.id ||
      searchParams.get("data.id") ||
      searchParams.get("id") ||
      body?.id;

    const eventType = body?.type || searchParams.get("topic") || body?.action;

    if (!paymentId) {
      return Response.json({ message: "Webhook recibido sin ID de pago." }, { status: 200 });
    }

    // 1. Verificación de firma criptográfica HMAC-SHA256
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

    // 2. Consultar el pago en la API de Mercado Pago
    const mpPayment = await getMercadoPagoPayment(paymentId);

    if (
      !mpPayment ||
      (mpPayment.status !== "approved" && mpPayment.status_detail !== "simulated_without_token")
    ) {
      console.log(
        `[Webhook MercadoPago] El pago ${paymentId} aún no está aprobado (Estado: ${mpPayment?.status}).`
      );
      return Response.json({ message: "Pago no aprobado aún.", status: mpPayment?.status }, { status: 200 });
    }

    // 3. Extraer la referencia externa del pedido (PED-{orderId})
    const extRef = mpPayment.external_reference || body?.external_reference || "";
    let orderId: number | null = null;

    if (extRef && extRef.startsWith("PED-")) {
      orderId = Number(extRef.replace("PED-", ""));
    } else if (!Number.isNaN(Number(extRef)) && Number(extRef) > 0) {
      orderId = Number(extRef);
    }

    if (!orderId) {
      return Response.json(
        { message: "Pago verificado sin comanda asociada directa.", paymentId },
        { status: 200 }
      );
    }

    // 4. Procesar la aprobación de manera idempotente
    const approvalResult = await processMercadoPagoPaymentApproval(paymentId, orderId, {
      paymentMethodName: "Mercado Pago",
      voucherType: "Boleta",
    });

    return Response.json(
      {
        message: approvalResult.message,
        success: approvalResult.success,
        orderId: approvalResult.orderId,
        alreadyProcessed: approvalResult.alreadyProcessed,
        invoice: approvalResult.invoice,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Webhook MercadoPago] Error al procesar notificación:", error);
    return Response.json(
      { message: "Error registrado en servidor.", detail: message },
      { status: 200 }
    );
  }
}

export async function GET() {
  return Response.json({
    status: "active",
    service: "Webhook Mercado Pago - Pollería ERP",
    date: new Date().toISOString(),
  });
}
