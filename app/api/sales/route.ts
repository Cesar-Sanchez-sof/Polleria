import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDailySalesSummary } from "@/lib/utils/sales-helpers";
import { postSaleJournalEntries } from "@/lib/services/accounting-posting.service";
import { uploadVoucherToS3, uploadPaymentProofToS3, buildVoucherS3Key, getS3Config } from "@/lib/services/s3-storage.service";
import { broadcastRealtimeEvent } from "@/lib/realtime/event-emitter";
import { authorize } from "@/lib/auth/permissions";
import { formatDateToIso } from "@/lib/dates";
import { getPrinterConfig } from "@/lib/services/restaurant-config.service";
import { isValidVoucherSeries, formatVoucherCode } from "@/lib/utils/series-validation";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/sales:
 *   post:
 *     tags:
 *       - Sales
 *     summary: Registrar una venta
 *   get:
 *     tags:
 *       - Sales
 *     summary: Listar ventas
 */

type PersonTypeValue = "Natural" | "Legal";

interface SplitPaymentInput {
  paymentTypeId?: number;
  payment_type_id?: number;
  amount?: number;
}

interface RegisterSaleInput {
  orderId?: number;
  order_id?: number;
  cashSessionId?: number;
  cash_session_id?: number;
  paymentTypeId?: number;
  payment_type_id?: number;
  payments?: SplitPaymentInput[];
  voucherType?: "Boleta" | "Factura";
  voucher_type?: "Boleta" | "Factura";
  series?: string;
  serie?: string;
  customer?: {
    documentNumber?: string;
    document_number?: string;
    firstName?: string;
    name?: string;
    personType?: "Natural" | "Legal" | "Juridico";
    person_type?: "Natural" | "Legal" | "Juridico";
    phone?: string;
  };
  amountReceived?: number;
  received_amount?: number;
  gateway?: {
    provider?: string;
    mode?: "tap_to_pay" | "qr" | "manual";
    operationId?: string;
  };
  yapeProofImage?: string;
}

function normalizePersonType(value: unknown): PersonTypeValue {
  if (value === "Legal" || value === "Juridico") return "Legal";
  return "Natural";
}

export async function POST(request: NextRequest) {
  const auth = await authorize("ventas.crear");
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => null)) as RegisterSaleInput | null;
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Datos de venta no válidos." }, { status: 400 });
    }

    const orderId = Number(body.orderId ?? body.order_id);
    const paymentTypeId = body.paymentTypeId ?? body.payment_type_id;
    const voucherType = body.voucherType ?? body.voucher_type;
    const customerInput = body.customer;
    const amountReceived = body.amountReceived ?? body.received_amount;
    const gateway = body.gateway;

    if (!orderId || Number.isNaN(orderId)) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const splitPayments = body.payments;
    const isSplitPayment = Array.isArray(splitPayments) && splitPayments.length > 0;

    if (!isSplitPayment && (!paymentTypeId || Number.isNaN(Number(paymentTypeId)))) {
      return Response.json({ error: "Debe seleccionar un método de pago válido." }, { status: 400 });
    }

    let paymentType: { id: number; name: string; active: boolean } | null = null;
    const paymentsList: Array<{ paymentTypeId: number; amount: number; name: string }> = [];

    if (isSplitPayment) {
      const paymentTypesDb = await prisma.paymentType.findMany({ where: { active: true } });
      const paymentTypesMap = new Map<number, (typeof paymentTypesDb)[0]>(
        paymentTypesDb.map((t) => [t.id, t])
      );
      for (const p of splitPayments!) {
        const idTP = Number(p.paymentTypeId ?? p.payment_type_id);
        const amountNum = Math.round(Number(p.amount) * 100) / 100;
        const tp = paymentTypesMap.get(idTP);
        if (!tp) {
          return Response.json({ error: `El método de pago con ID ${idTP} no está disponible.` }, { status: 400 });
        }
        if (amountNum <= 0) {
          return Response.json({ error: "El monto de cada pago parcial debe ser mayor a 0." }, { status: 400 });
        }
        paymentsList.push({ paymentTypeId: idTP, amount: amountNum, name: tp.name });
      }
    } else {
      paymentType = await prisma.paymentType.findUnique({
        where: { id: Number(paymentTypeId) }
      });
      if (!paymentType || !paymentType.active) {
        return Response.json({ error: "El método de pago no está disponible." }, { status: 400 });
      }
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        tables: { include: { table: true } },
        items: { include: { product: true } }
      }
    });

    if (!order) {
      return Response.json({ error: "El pedido a cobrar no existe." }, { status: 404 });
    }

    if (order.status === "Closed") {
      return Response.json(
        { error: "Operación inválida: El pedido ya fue cobrado y cerrado anteriormente." },
        { status: 400 }
      );
    }

    if (order.status === "Cancelled") {
      return Response.json(
        { error: "Operación rechazada: Un pedido cancelado no puede convertirse en una venta ni generar cobro." },
        { status: 400 }
      );
    }

    if (order.items.length === 0) {
      return Response.json(
        { error: "El pedido no contiene ítems para ser cobrado." },
        { status: 400 }
      );
    }

    const saleTotal = order.items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );
    const roundedTotal = Math.round(saleTotal * 100) / 100;

    const taxableSubtotal = Math.round((roundedTotal / 1.18) * 100) / 100;
    const calculatedIgv = Math.round((roundedTotal - taxableSubtotal) * 100) / 100;

    if (isSplitPayment) {
      const paymentsSum = Math.round(paymentsList.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      if (Math.abs(paymentsSum - roundedTotal) > 0.05) {
        return Response.json(
          { error: `La suma de las partes de pago (S/ ${paymentsSum.toFixed(2)}) no coincide con el total de la cuenta (S/ ${roundedTotal.toFixed(2)}).` },
          { status: 400 }
        );
      }
    } else {
      if (paymentType && paymentType.name.toLowerCase().includes("efectivo") && amountReceived) {
        if (amountReceived < roundedTotal) {
          return Response.json(
            { error: `El monto entregado (S/ ${amountReceived.toFixed(2)}) es menor al total a cobrar (S/ ${roundedTotal.toFixed(2)}).` },
            { status: 400 }
          );
        }
      }
    }

    let customerId: number;
    const customerDoc = (customerInput?.documentNumber ?? customerInput?.document_number)?.trim() || "00000000";
    const customerName = (customerInput?.firstName ?? customerInput?.name)?.trim() || "CLIENTE GENERAL";
    const rawPersonType = customerInput?.personType ?? customerInput?.person_type;
    const personType = normalizePersonType(
      rawPersonType ?? (customerDoc.length === 11 ? "Legal" : "Natural")
    );

    const existingCustomer = await prisma.customer.findFirst({
      where: { documentNumber: customerDoc, personType }
    });

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const newCustomer = await prisma.customer.create({
        data: {
          documentNumber: customerDoc,
          firstName: customerName,
          personType,
          phone: (customerInput?.phone)?.trim() || null,
          active: true
        }
      });
      customerId = newCustomer.id;
    }

    const docType = voucherType === "Factura" ? "Factura" : "Boleta";

    // Obtener serie configurada dinámicamente desde la configuración de comprobantes / impresoras
    const printerConfig = await getPrinterConfig();
    const configuredSeries = docType === "Factura"
      ? (printerConfig?.series?.factura || "")
      : (printerConfig?.series?.boleta || "");

    const requestedSeries = (body.series ?? body.serie)?.trim().toUpperCase();
    const series = requestedSeries || configuredSeries;

    // Validar que la serie cumpla el estándar SUNAT (B### para boleta, F### para factura)
    if (!isValidVoucherSeries(series, docType)) {
      return Response.json(
        {
          error: `Serie inválida "${series}" para ${docType}. Debe cumplir con el formato ${docType === "Factura" ? "F###" : "B###"} autorizado por SUNAT.`
        },
        { status: 400 }
      );
    }

    const lastVoucher = await prisma.salesInvoice.findFirst({
      where: { voucherType: docType, series },
      orderBy: { number: "desc" }
    });
    const sequentialNumber = (lastVoucher?.number ?? 0) + 1;
    const fullCode = formatVoucherCode(series, sequentialNumber);

    // Detectar si hay sesión de caja activa
    let currentSessionId = body.cashSessionId ?? body.cash_session_id;
    if (!currentSessionId) {
      try {
        const activeSess = await (prisma as any).cashSession.findFirst({
          where: { status: "OPEN" },
          orderBy: { id: "desc" },
        });
        if (activeSess) currentSessionId = activeSess.id;
      } catch {
        // Fallback si la migración aún no está corrida en caliente
      }
    }

    const initialS3Key = buildVoucherS3Key({
      voucherId: 0,
      voucherType: docType as "Boleta" | "Factura",
      serie: series,
      number: sequentialNumber,
      format: "pdf",
      date: new Date(),
    });
    const { endpoint, bucket, accessKey, secretKey } = getS3Config();
    const hasValidRemoteCreds =
      accessKey &&
      secretKey &&
      !accessKey.includes("TU_KEY") &&
      endpoint &&
      !endpoint.includes("s3.neon.tech");
    const initialS3Url = hasValidRemoteCreds
      ? `${endpoint}/${bucket}/${initialS3Key}`
      : `/storage/comprobantes/${initialS3Key}`;

    const now = new Date();
    // Normalizar la fecha del comprobante al huso horario oficial de Perú (America/Lima, UTC-5)
    const peruDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [pYear, pMonth, pDay] = peruDateFormatter.format(now).split("-").map(Number);
    const peruDateOnly = new Date(Date.UTC(pYear, pMonth - 1, pDay));

    const transaction = await prisma.$transaction(async (tx) => {
      const invoiceData: any = {
        orderId: order.id,
        customerId,
        voucherType: docType,
        series,
        number: sequentialNumber,
        subtotal: taxableSubtotal,
        igv: calculatedIgv,
        totalAmount: roundedTotal,
        status: "Issued",
        s3Url: initialS3Url,
        issuedAt: peruDateOnly,
        createdAt: now,
      };

      if (currentSessionId) {
        invoiceData.cashSessionId = currentSessionId;
      }

      const invoice = await tx.salesInvoice.create({
        data: invoiceData,
      });

      if (isSplitPayment) {
        for (const p of paymentsList) {
          await tx.salesPayment.create({
            data: {
              salesInvoiceId: invoice.id,
              paymentTypeId: p.paymentTypeId,
              amount: p.amount,
              paidAt: now
            }
          });
        }
      } else {
        await tx.salesPayment.create({
          data: {
            salesInvoiceId: invoice.id,
            paymentTypeId: paymentType!.id,
            amount: roundedTotal,
            paidAt: now
          }
        });
      }

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "Closed" }
      });

      if (order.tables.length > 0) {
        for (const pm of order.tables) {
          await tx.diningTable.update({
            where: { id: pm.tableId },
            data: { active: true }
          });

          if (pm.notes) {
            const match = pm.notes.match(/\[Mesas unidas:\s*([0-9,\s]+)\]/i);
            if (match && match[1]) {
              const tableNumbers = match[1]
                .split(",")
                .map((n) => Number(n.trim()))
                .filter((n) => !Number.isNaN(n));
              if (tableNumbers.length > 0) {
                await tx.diningTable.updateMany({
                  where: { number: { in: tableNumbers } },
                  data: { active: true }
                });
              }
            }
          }
        }
      }

      // Actualizar montos en la sesión de caja activa
      if (currentSessionId) {
        try {
          let cashPortion = 0;
          let otherPortion = 0;
          if (isSplitPayment) {
            for (const p of paymentsList) {
              if (p.name.toLowerCase().includes("efectivo")) cashPortion += p.amount;
              else otherPortion += p.amount;
            }
          } else {
            const isCash = paymentType?.name.toLowerCase().includes("efectivo");
            if (isCash) cashPortion = roundedTotal;
            else otherPortion = roundedTotal;
          }

          await (tx as any).cashSession.update({
            where: { id: currentSessionId },
            data: {
              salesCash: { increment: cashPortion },
              salesOther: { increment: otherPortion },
              totalSales: { increment: roundedTotal },
            },
          });
        } catch {
          // Ignorar si la tabla de sesión aún no está migrada en la BD
        }
      }

      const paymentMethodNameForJournal = isSplitPayment
        ? paymentsList.map((p) => p.name).join(" + ")
        : (paymentType?.name ?? "Efectivo");

      let journalEntryIds: number[] = [];
      try {
        journalEntryIds = await postSaleJournalEntries(tx, {
          salesInvoiceId: invoice.id,
          voucherCode: fullCode,
          entryDate: now,
          subtotal: taxableSubtotal,
          igv: calculatedIgv,
          total: roundedTotal,
          paymentMethodName: paymentMethodNameForJournal,
          payments: isSplitPayment ? paymentsList.map((p) => ({ name: p.name, amount: p.amount })) : undefined,
          responsible: "Caja / Ventas",
        });
      } catch (postErr) {
        console.warn("[api/sales] Asiento contable registrado con advertencia:", postErr);
      }

      return { invoice, journalEntryIds };
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    let finalS3Url = initialS3Url;
    let yapeProofUrl: string | null = null;

    // Si el mozo o cajero tomó una foto del comprobante de Yape, subirla a S3
    if (body.yapeProofImage) {
      try {
        const proofRes = await uploadPaymentProofToS3({
          orderId: order.id,
          serie: series,
          number: sequentialNumber,
          imageBase64: body.yapeProofImage,
        });
        if (proofRes.publicUrl) {
          yapeProofUrl = proofRes.publicUrl;
          finalS3Url = proofRes.publicUrl;
          await prisma.salesInvoice.update({
            where: { id: transaction.invoice.id },
            data: { s3Url: proofRes.publicUrl },
          }).catch(() => null);
        }
      } catch (proofErr) {
        console.warn("[api/sales] Error al subir comprobante Yape a S3:", proofErr);
      }
    }

    // Archivar comprobante en S3 de manera no bloqueante y sincronizar URL en BD (si no se reemplazó por la foto de Yape)
    try {
      const s3Res = await uploadVoucherToS3({
        voucherId: transaction.invoice.id,
        voucherType: docType as "Boleta" | "Factura",
        serie: series,
        number: sequentialNumber,
        format: "pdf",
        date: transaction.invoice.issuedAt ? new Date(transaction.invoice.issuedAt) : new Date(),
      });
      if (s3Res.publicUrl && !yapeProofUrl) {
        finalS3Url = s3Res.publicUrl;
        if (s3Res.publicUrl !== initialS3Url) {
          await prisma.salesInvoice.update({
            where: { id: transaction.invoice.id },
            data: { s3Url: s3Res.publicUrl },
          }).catch(() => null);
        }
      }
    } catch (s3Err) {
      console.warn("[api/sales] Aviso de archivado en S3:", s3Err);
    }

    const primaryTableOrder = order.tables.find((t) => !t.notes?.includes("[Anexa a Mesa")) ?? order.tables[0];
    const associatedTable = primaryTableOrder?.table ?? null;
    const change = amountReceived ? Math.max(0, Math.round((amountReceived - roundedTotal) * 100) / 100) : 0;

    const paymentMethodName = isSplitPayment
      ? `Pago en Partes (${paymentsList.map((p) => `${p.name}: S/ ${p.amount.toFixed(2)}`).join(" + ")})`
      : (paymentType?.name ?? "Efectivo");

    const safeIssuedAt = (transaction.invoice.createdAt || now).toISOString();

    // Sincronización en tiempo real: Liberación de mesas y notificación de cobro en caja
    try {
      broadcastRealtimeEvent("PAYMENT_RECEIVED", {
        orderId: order.id,
        orderCode: order.code,
        voucherCode: fullCode,
        total: roundedTotal,
        paymentMethod: paymentMethodName,
        origin: associatedTable ? `Mesa ${associatedTable.number}` : "Llevar",
      });

      broadcastRealtimeEvent("TABLE_UPDATED", {
        orderId: order.id,
        reason: "COBRO_FINALIZADO",
      });
    } catch (rtErr) {
      console.warn("[api/sales] Error al emitir evento en tiempo real:", rtErr);
    }

    return Response.json(
      {
        message: "Venta registrada, pedido cerrado, mesa liberada y asientos contables generados.",
        journalEntriesCount: transaction.journalEntryIds?.length || 0,
        journalEntryIds: transaction.journalEntryIds || [],
        invoice: {
          id: transaction.invoice.id,
          voucherType: docType,
          series,
          number: sequentialNumber,
          fullCode,
          s3Url: finalS3Url,
          yapeProofUrl: yapeProofUrl || (finalS3Url.includes("yape-vouchers") ? finalS3Url : null),
          issuedAt: safeIssuedAt,
          subtotal: taxableSubtotal,
          igv: calculatedIgv,
          total: roundedTotal,
          paymentMethod: paymentMethodName,
          amountReceived: amountReceived ?? roundedTotal,
          change,
          customer: {
            firstName: customerName,
            documentNumber: customerDoc,
            personType
          },
          origin: associatedTable ? `Mesa ${associatedTable.number}` : "Pedido Para Llevar",
          items: (order.items || []).map((d) => ({
            name: d.product?.name || "Plato",
            quantity: d.quantity,
            unitPrice: Number(d.unitPrice),
            subtotal: Number(d.subtotal),
            notes: d.notes ?? ""
          })),
          gateway: gateway ? {
            provider: gateway.provider || "mercado_pago",
            mode: gateway.mode || "tap_to_pay",
            status: "completed"
          } : null
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/sales] Error al registrar venta:", error);
    return Response.json(
      {
        error: error?.message || "No se pudo completar el cobro y cierre de la venta.",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await authorize("ventas.ver");
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") ?? searchParams.get("fecha");

    const whereClause: Record<string, unknown> = {};

    if (dateParam && dateParam !== "all" && dateParam !== "todas") {
      let baseDate: Date;
      if (dateParam === "today" || dateParam === "hoy") {
        baseDate = new Date();
      } else {
        baseDate = new Date(dateParam);
      }

      const startDate = new Date(baseDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(baseDate);
      endDate.setHours(23, 59, 59, 999);

      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const vouchers = await prisma.salesInvoice.findMany({
      where: whereClause,
      include: {
        customer: true,
        payments: {
          include: {
            paymentType: true,
          },
        },
        journalEntries: {
          select: {
            id: true,
            code: true,
            book: true,
            entryDate: true,
            createdAt: true,
            description: true,
            status: true,
          },
        },
        order: {
          include: {
            tables: {
              include: {
                table: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
      take: 150,
    });

    const formattedList = vouchers.map((c) => {
      const customerName = c.customer
        ? `${c.customer.firstName}${c.customer.lastName ? " " + c.customer.lastName : ""}`.trim()
        : "CLIENTE GENERAL";
      const primaryTableOrder = c.order?.tables.find((t) => !t.notes?.includes("[Anexa a Mesa")) ?? c.order?.tables[0];
      const associatedTable = primaryTableOrder?.table;
      const paymentMethod = c.payments[0]?.paymentType?.name || "Efectivo";

      return {
        id: c.id,
        orderId: c.orderId,
        voucherType: c.voucherType as "Boleta" | "Factura" | "Ticket",
        series: c.series,
        number: c.number,
        fullCode: formatVoucherCode(c.series, c.number),
        s3Url:
          c.s3Url ||
          `/storage/comprobantes/${buildVoucherS3Key({
            voucherId: c.id,
            voucherType: c.voucherType as any,
            serie: c.series,
            number: c.number,
            date: c.createdAt,
          })}`,
        issuedAt: c.createdAt.toISOString(),
        subtotal: Number(c.subtotal),
        igv: Number(c.igv),
        total: Number(c.totalAmount),
        status: c.status,
        paymentMethod,
        amountReceived: Number(c.totalAmount),
        change: 0,
        customer: {
          id: c.customer?.id,
          firstName: customerName,
          documentNumber: c.customer?.documentNumber || "00000000",
          personType: c.customer?.personType || "Natural",
        },
        origin: associatedTable ? `Mesa ${associatedTable.number}` : "Pedido Para Llevar",
        journalEntries: (c.journalEntries || []).map((je) => ({
          id: je.id,
          code: je.code,
          book: je.book,
          entryDate: formatDateToIso(je.entryDate),
          createdAt: je.createdAt.toISOString(),
          description: je.description,
          status: je.status ? "Registrado" : "Anulado",
        })),
        items:
          c.order?.items.map((d) => ({
            name: d.product.name,
            quantity: d.quantity,
            unitPrice: Number(d.unitPrice),
            subtotal: Number(d.subtotal),
            notes: d.notes || "",
          })) || [],
      };
    });

    const dailySummary = calculateDailySalesSummary(
      formattedList.map((v) => ({
        total: v.total,
        paymentMethod: v.paymentMethod,
        voucherType: v.voucherType,
        issuedAt: v.issuedAt,
      }))
    );

    return Response.json({
      data: formattedList,
      dailySummary,
    });
  } catch (error) {
    console.error("[api/sales] Error al listar comprobantes y ventas:", error);
    return Response.json(
      { error: "No se pudieron obtener las ventas registradas." },
      { status: 500 }
    );
  }
}
