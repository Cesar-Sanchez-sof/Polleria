import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature
} from "@/lib/services/mercadopago.service";
import { uploadVoucherToS3 } from "@/lib/services/s3-storage.service";

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

    // Mercado Pago puede enviar el ID por body (data.id) o por searchParams (id o data.id)
    const paymentId =
      body?.data?.id ||
      searchParams.get("data.id") ||
      searchParams.get("id") ||
      body?.id;

    const tipoEvento = body?.type || searchParams.get("topic") || body?.action;

    // Responder 200 a eventos de prueba o pings de handshake
    if (!paymentId) {
      return Response.json({ mensaje: "Webhook recibido sin ID de pago." }, { status: 200 });
    }

    // Validar firma criptográfica si está configurado MERCADO_PAGO_WEBHOOK_SECRET
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    const validacionFirma = verifyMercadoPagoWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataId: String(paymentId),
    });

    if (!validacionFirma.isValid) {
      console.warn(`[Webhook MercadoPago] Firma rechazada: ${validacionFirma.reason}`);
      return Response.json(
        { error: "Firma de webhook inválida.", detalle: validacionFirma.reason },
        { status: 401 }
      );
    }

    console.log(`[Webhook MercadoPago] Evento recibido: ${tipoEvento}, Payment ID: ${paymentId}`);

    // Consultar el estado del pago (si hay Access Token consulta la API, sino valida simulación)
    const pagoMP = await getMercadoPagoPayment(paymentId);

    if (!pagoMP || (pagoMP.status !== "approved" && pagoMP.status_detail !== "simulated_without_token")) {
      console.log(`[Webhook MercadoPago] El pago ${paymentId} aún no está aprobado (Estado: ${pagoMP?.status}).`);
      return Response.json({ mensaje: "Pago no aprobado aún." }, { status: 200 });
    }

    // Extraer referencia del pedido (ej: "PED-12" o id de comanda)
    const extRef = pagoMP.external_reference || body?.external_reference || "";
    let idPedido: number | null = null;

    if (extRef && extRef.startsWith("PED-")) {
      idPedido = Number(extRef.replace("PED-", ""));
    } else if (!Number.isNaN(Number(extRef))) {
      idPedido = Number(extRef);
    }

    if (!idPedido) {
      // Si no viene en external_reference, buscar primer pedido activo de tipo Mesa o Llevar
      return Response.json({ mensaje: "Pago verificado sin pedido asociado directo." }, { status: 200 });
    }

    // Buscar el pedido en la base de datos
    const pedido = await prisma.pedido.findUnique({
      where: { id_pedido: idPedido },
      include: {
        pedidos_mesa: { include: { mesa: true } },
        detalles_pedido: true,
      },
    });

    if (!pedido) {
      return Response.json({ error: `Pedido ${idPedido} no encontrado.` }, { status: 200 });
    }

    // Idempotencia: Si ya está cerrado, no volver a cobrar
    if (pedido.estado === "Cerrado") {
      return Response.json({ mensaje: "El pedido ya se encontraba cerrado." }, { status: 200 });
    }

    // Obtener método de pago Tarjeta/POS en el sistema
    const tipoPagoTarjeta = await prisma.tipo_pago.findFirst({
      where: {
        OR: [
          { nombre: { contains: "POS", mode: "insensitive" } },
          { nombre: { contains: "Tarjeta", mode: "insensitive" } },
        ],
      },
    });

    const idTipoPago = tipoPagoTarjeta ? tipoPagoTarjeta.id_tipo_pago : 1;

    // Calcular montos oficiales
    const total = pedido.detalles_pedido.reduce((acc, it) => acc + Number(it.sub_total), 0);
    const totalRedondeado = Math.round(total * 100) / 100;
    const subtotal = Math.round((totalRedondeado / 1.18) * 100) / 100;
    const igv = Math.round((totalRedondeado - subtotal) * 100) / 100;

    // Obtener cliente general
    const clienteGeneral = await prisma.cliente.findFirst({
      where: { nro_doc: "00000000" },
    });

    const idCliente = clienteGeneral?.id_cliente || 1;

    // Generar serie y correlativo para Boleta/Ticket
    const serie = "B001";
    const ultimoComprobante = await prisma.comprobante_venta.findFirst({
      where: { serie },
      orderBy: { numero: "desc" },
    });
    const correlativo = (ultimoComprobante?.numero ?? 0) + 1;

    let idComprobanteCreado: number | null = null;

    // Transacción atómica: Crear Comprobante -> Registrar Pago -> Cerrar Pedido -> Liberar Mesa
    await prisma.$transaction(async (tx) => {
      const comprobante = await tx.comprobante_venta.create({
        data: {
          id_pedido: pedido.id_pedido,
          id_cliente: idCliente,
          tipo_comprobante: "Boleta",
          serie,
          numero: correlativo,
          subtotal,
          igv,
          monto_total: totalRedondeado,
          estado: "Emitido",
          fecha_emision: new Date(),
        },
      });

      idComprobanteCreado = comprobante.id_comprobante_venta;

      await tx.pago_venta.create({
        data: {
          id_comprobante_venta: comprobante.id_comprobante_venta,
          id_tipo_pago: idTipoPago,
          monto: totalRedondeado,
          fecha_pago: new Date(),
        },
      });

      await tx.pedido.update({
        where: { id_pedido: pedido.id_pedido },
        data: { estado: "Cerrado" },
      });

      if (pedido.pedidos_mesa.length > 0) {
        for (const pm of pedido.pedidos_mesa) {
          await tx.mesa.update({
            where: { id_mesa: pm.id_mesa },
            data: { estado: true }, // Liberar mesa
          });
        }
      }
    });

    // Archivar automáticamente el comprobante en el Bucket S3 'comprobantes'
    if (idComprobanteCreado) {
      await uploadVoucherToS3({
        idComprobante: idComprobanteCreado,
        tipoComprobante: "Boleta",
        serie,
        numero: correlativo,
        formato: "pdf",
        fecha: new Date(),
      }).catch((s3Err) => {
        console.warn("[Webhook MercadoPago] Advertencia al archivar en S3:", s3Err);
      });
    }

    console.log(`[Webhook MercadoPago] Pedido ${idPedido} cerrado, mesa liberada y comprobante B001-${correlativo} archivado en S3.`);
    return Response.json({ mensaje: "Pago procesado, mesa liberada y comprobante archivado con éxito." }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook MercadoPago] Error al procesar notificación:", error);
    // Siempre retornar 200 a Mercado Pago para evitar que reintente infinitamente
    return Response.json({ mensaje: "Error registrado en servidor.", detalle: error.message }, { status: 200 });
  }
}

/**
 * Handshake GET para verificación de URL en el Panel de Desarrolladores de Mercado Pago.
 */
export async function GET() {
  return Response.json({
    estado: "activo",
    servicio: "Webhook Mercado Pago - Pollería ERP",
    fecha: new Date().toISOString(),
  });
}
