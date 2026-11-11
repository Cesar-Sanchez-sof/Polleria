import { prisma } from "@/lib/prisma";
import { calculateDailySalesSummary } from "@/lib/utils/sales-helpers";
import { postSaleJournalEntries } from "@/lib/services/accounting/accounting-posting.service";
import {
  uploadVoucherToS3,
  uploadPaymentProofToS3,
  buildVoucherS3Key,
  getS3Config,
  getVoucherPresignedUrl,
} from "@/lib/services/integrations/s3-storage.service";
import { broadcastRealtimeEvent } from "@/lib/realtime/event-emitter";
import { formatDateToIso } from "@/lib/dates";
import { ClosedPeriodError } from "@/lib/accounting/closing";
import { getPrinterConfig } from "@/lib/services/settings/restaurant-config.service";
import { isValidVoucherSeries, formatVoucherCode } from "@/lib/utils/series-validation";
import {
  findOrCreateCustomerForSale,
  type PersonTypeValue,
} from "@/lib/services/sales/customers.service";
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from "@/lib/http/route-handler";

export interface SplitPaymentInput {
  paymentTypeId?: number;
  payment_type_id?: number;
  amount?: number;
}

export interface RegisterSaleInput {
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

export interface SaleInvoiceDto {
  id: number;
  voucherType: string;
  series: string;
  number: number;
  fullCode: string;
  s3Url: string;
  yapeProofUrl: string | null;
  issuedAt: string;
  subtotal: number;
  igv: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  customer: {
    id?: number;
    firstName: string;
    documentNumber: string;
    personType: string;
  };
  origin: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes: string;
  }>;
}

function mapOrderItemsToInvoiceItems(
  items: Array<{
    quantity: number;
    unitPrice: any;
    subtotal: any;
    notes: string | null;
    product: { name: string };
  }> = []
) {
  return items.map((d) => ({
    name: d.product.name,
    quantity: d.quantity,
    unitPrice: Number(d.unitPrice),
    subtotal: Number(d.subtotal),
    notes: d.notes || "",
  }));
}

export interface RegisterSaleResult {
  message: string;
  journalEntriesCount: number;
  journalEntryIds: number[];
  invoice: SaleInvoiceDto;
  printData?: any;
}

/**
 * Registra una venta completa con emisión de comprobante, liberación de mesas,
 * actualización de caja y asientos contables automáticos.
 */
export async function registerSale(body: RegisterSaleInput): Promise<RegisterSaleResult> {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Datos de venta no válidos.");
  }

  const orderId = Number(body.orderId ?? body.order_id);
  const paymentTypeId = body.paymentTypeId ?? body.payment_type_id;
  const voucherType = body.voucherType ?? body.voucher_type;
  const customerInput = body.customer;
  const amountReceived = body.amountReceived ?? body.received_amount;
  const gateway = body.gateway;

  if (!orderId || Number.isNaN(orderId)) {
    throw new ValidationError("ID de pedido inválido.");
  }

  const splitPayments = body.payments;
  const isSplitPayment = Array.isArray(splitPayments) && splitPayments.length > 0;

  if (!isSplitPayment && (!paymentTypeId || Number.isNaN(Number(paymentTypeId)))) {
    throw new ValidationError("Debe seleccionar un método de pago válido.");
  }

  let paymentType: { id: number; name: string; active: boolean } | null = null;
  const paymentsList: Array<{ paymentTypeId: number; amount: number; name: string }> = [];

  if (isSplitPayment) {
    const paymentTypesDb = await prisma.paymentType.findMany({ where: { active: true } });
    const pMap = new Map(paymentTypesDb.map((p) => [p.id, p]));

    for (const sp of splitPayments) {
      const pid = Number(sp.paymentTypeId ?? sp.payment_type_id);
      const amt = Number(sp.amount);
      const found = pMap.get(pid);

      if (!found || Number.isNaN(amt) || amt <= 0) {
        throw new ValidationError("Uno o más métodos de pago divididos son inválidos o tienen montos menores o iguales a cero.");
      }
      paymentsList.push({ paymentTypeId: pid, amount: amt, name: found.name });
    }
  } else {
    paymentType = await prisma.paymentType.findUnique({
      where: { id: Number(paymentTypeId) },
    });

    if (!paymentType || !paymentType.active) {
      throw new ValidationError("Método de pago no válido o inactivo.");
    }
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      tables: { include: { table: true } },
      items: { include: { product: true } },
    },
  });

  if (!order) {
    throw new NotFoundError("Pedido no encontrado.");
  }

  if (order.status === "Closed") {
    throw new ValidationError("El pedido ya se encuentra cerrado y facturado.");
  }

  if (order.status === "Cancelled") {
    throw new ValidationError("No se puede facturar un pedido cancelado.");
  }

  const orderCalculatedTotal = order.items.reduce(
    (acc, it) => acc + Number(it.unitPrice) * it.quantity,
    0
  );
  const roundedTotal = Math.round(orderCalculatedTotal * 100) / 100;

  if (isSplitPayment) {
    const sumSplits = paymentsList.reduce((acc, p) => acc + p.amount, 0);
    const diff = Math.abs(sumSplits - roundedTotal);
    if (diff > 0.05) {
      throw new ValidationError(`La suma de pagos divididos (S/ ${sumSplits.toFixed(2)}) no coincide con el total de la comanda (S/ ${roundedTotal.toFixed(2)}).`);
    }
  }

  if (!isSplitPayment && paymentType?.name === "Efectivo" && amountReceived) {
    if (amountReceived < roundedTotal) {
      throw new ValidationError(`El monto recibido (S/ ${amountReceived.toFixed(2)}) es menor al total a pagar (S/ ${roundedTotal.toFixed(2)}).`);
    }
  }

  // Resolver o registrar cliente
  const customerResult = await findOrCreateCustomerForSale(customerInput);
  const customerId = customerResult.id;
  const customerName = customerResult.name;
  const customerDoc = customerResult.document;
  const personType = customerResult.personType;

  const docType = voucherType === "Factura" ? "Factura" : "Boleta";

  const printerConfig = await getPrinterConfig();
  const configuredSeries = docType === "Factura"
    ? (printerConfig?.series?.factura || "")
    : (printerConfig?.series?.boleta || "");

  const requestedSeries = (body.series ?? body.serie)?.trim().toUpperCase();
  const series = requestedSeries || configuredSeries;

  if (!isValidVoucherSeries(series, docType)) {
    throw new ValidationError(`Serie inválida "${series}" para ${docType}. Debe cumplir con el formato ${docType === "Factura" ? "F###" : "B###"} autorizado por SUNAT.`);
  }

  const lastVoucher = await prisma.salesInvoice.findFirst({
    where: { series },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const sequentialNumber = (lastVoucher?.number || 0) + 1;
  const fullCode = formatVoucherCode(series, sequentialNumber);

  // Sesión de caja activa
  let currentSessionId: number | null = null;
  const explicitSessionId = Number(body.cashSessionId ?? body.cash_session_id);
  if (explicitSessionId && !Number.isNaN(explicitSessionId)) {
    currentSessionId = explicitSessionId;
  } else {
    try {
      const activeSess = await (prisma as any).cashSession?.findFirst?.({
        where: { status: "OPEN" },
        orderBy: { id: "desc" },
        select: { id: true },
      });
      if (activeSess) {
        currentSessionId = activeSess.id;
      }
    } catch (e) {
      console.warn("[sales.service] Aviso al consultar sesión activa de caja:", e);
    }
  }

  const taxableSubtotal = Math.round((roundedTotal / 1.18) * 100) / 100;
  const calculatedIgv = Math.round((roundedTotal - taxableSubtotal) * 100) / 100;

  const initialS3Key = buildVoucherS3Key({
    voucherId: 0,
    voucherType: docType as any,
    serie: series,
    number: sequentialNumber,
    date: new Date(),
  });

  const { endpoint, bucket } = getS3Config();
  const hasValidRemoteCreds =
    process.env.AWS_ACCESS_KEY_ID &&
    !process.env.AWS_ACCESS_KEY_ID.includes("placeholder") &&
    endpoint &&
    !endpoint.includes("s3.neon.tech");
  const initialS3Url = hasValidRemoteCreds
    ? `${endpoint}/${bucket}/${initialS3Key}`
    : `/storage/comprobantes/${initialS3Key}`;

  const now = new Date();
  const peruDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [pYear, pMonth, pDay] = peruDateFormatter.format(now).split("-").map(Number);
  const peruDateOnly = new Date(Date.UTC(pYear, pMonth - 1, pDay));


  const paymentMethodName = isSplitPayment
    ? `Pago en Partes (${paymentsList.map((p) => `${p.name}: S/ ${p.amount.toFixed(2)}`).join(" + ")})`
    : (paymentType?.name ?? "Efectivo");

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
            paidAt: now,
          },
        });
      }
    } else {
      await tx.salesPayment.create({
        data: {
          salesInvoiceId: invoice.id,
          paymentTypeId: paymentType!.id,
          amount: roundedTotal,
          paidAt: now,
        },
      });
    }

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

    if (currentSessionId) {
      try {
        let cashIncrement = 0;
        let otherIncrement = 0;

        if (isSplitPayment) {
          for (const sp of paymentsList) {
            if (sp.name.toLowerCase().includes("efectivo")) {
              cashIncrement += sp.amount;
            } else {
              otherIncrement += sp.amount;
            }
          }
        } else {
          if (paymentType?.name.toLowerCase().includes("efectivo")) {
            cashIncrement = roundedTotal;
          } else {
            otherIncrement = roundedTotal;
          }
        }

        await (tx as any).cashSession.update({
          where: { id: currentSessionId },
          data: {
            salesCash: { increment: Math.round(cashIncrement * 100) / 100 },
            salesOther: { increment: Math.round(otherIncrement * 100) / 100 },
            totalSales: { increment: roundedTotal },
          },
        });
      } catch (errSession) {
        console.warn("[sales.service] No se pudo actualizar ventas en sesión de caja:", errSession);
      }
    }

    let journalEntryIds: number[] = [];
    try {
      journalEntryIds = await postSaleJournalEntries(tx as any, {
        salesInvoiceId: invoice.id,
        orderId: order.id,
        voucherCode: fullCode,
        entryDate: now,
        subtotal: taxableSubtotal,
        igv: calculatedIgv,
        total: roundedTotal,
        paymentMethodName,
        payments: isSplitPayment
          ? paymentsList.map((p) => ({ name: p.name, amount: p.amount }))
          : undefined,
        responsible: "Caja",
      });
    } catch (acctError: any) {
      if (acctError instanceof ClosedPeriodError) {
        throw new ValidationError(acctError.message);
      }
      console.warn("[sales.service] Error al registrar asientos automáticos de venta:", acctError);
    }

    return { invoice, journalEntryIds };
  });

  let finalS3Url: string = typeof transaction.invoice.s3Url === "string" ? transaction.invoice.s3Url : "";
  let yapeProofUrl: string | null = null;

  try {
    const s3Res: any = await uploadVoucherToS3({
      voucherId: transaction.invoice.id,
      voucherType: docType as "Boleta" | "Factura",
      serie: series,
      number: sequentialNumber,
      format: "pdf",
      date: transaction.invoice.issuedAt ? new Date(transaction.invoice.issuedAt) : now,
    });

    const publicUrl = typeof s3Res === "string" ? s3Res : s3Res?.publicUrl || s3Res?.url;
    if (publicUrl && !yapeProofUrl) {
      finalS3Url = publicUrl;
      if (publicUrl !== initialS3Url) {
        await prisma.salesInvoice.update({
          where: { id: transaction.invoice.id },
          data: { s3Url: finalS3Url },
        });
      }
    }
  } catch (s3Error) {
    console.warn("[sales.service] Aviso en almacenamiento S3 de comprobante:", s3Error);
  }

  const primaryTableOrder = order.tables.find((t) => !t.notes?.includes("[Anexa a Mesa")) ?? order.tables[0];
  const associatedTable = primaryTableOrder?.table ?? null;
  const change = amountReceived ? Math.max(0, Math.round((amountReceived - roundedTotal) * 100) / 100) : 0;


  const safeIssuedAt = (transaction.invoice.createdAt || now).toISOString();

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
    console.warn("[sales.service] Error al emitir evento en tiempo real:", rtErr);
  }

  return {
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
      yapeProofUrl: yapeProofUrl || (typeof finalS3Url === "string" && finalS3Url.includes("yape-vouchers") ? finalS3Url : null),
      issuedAt: safeIssuedAt,
      subtotal: taxableSubtotal,
      igv: calculatedIgv,
      total: roundedTotal,
      paymentMethod: paymentMethodName,
      amountReceived: amountReceived ?? roundedTotal,
      change,
      customer: {
        id: customerId,
        firstName: customerName,
        documentNumber: customerDoc,
        personType,
      },
      origin: associatedTable ? `Mesa ${associatedTable.number}` : "Llevar",
      items: mapOrderItemsToInvoiceItems(order.items),
    },
  };
}

/**
 * Consulta la lista histórica de comprobantes de venta con resumen diario.
 */
export async function listSalesVouchers(filters?: {
  date?: string | null;
}): Promise<{ data: any[]; dailySummary: any }> {
  const dateParam = filters?.date;
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
      items: mapOrderItemsToInvoiceItems(c.order?.items || []),
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

  return {
    data: formattedList,
    dailySummary,
  };
}

/**
 * Consulta el detalle y URL de descarga de un comprobante almacenado en S3.
 */
export async function getVoucherDetailsById(
  voucherId: number,
  format?: string | null
): Promise<{
  id: number;
  invoiceCode: string;
  s3Url: string | null;
  downloadUrl: string | null;
  issuedAt: Date;
  total: any;
}> {
  if (!voucherId || Number.isNaN(voucherId)) {
    throw new ValidationError("ID de comprobante inválido.");
  }

  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: voucherId },
    include: {
      customer: true,
    },
  });

  if (!invoice) {
    throw new NotFoundError("Comprobante no encontrado.");
  }

  let downloadUrl: string | null = null;
  if (invoice.s3Url) {
    downloadUrl = await getVoucherPresignedUrl(invoice.s3Url, 3600);
  }

  return {
    id: invoice.id,
    invoiceCode: `${invoice.series}-${String(invoice.number).padStart(6, "0")}`,
    s3Url: invoice.s3Url,
    downloadUrl: downloadUrl || invoice.s3Url,
    issuedAt: invoice.issuedAt,
    total: invoice.totalAmount,
  };
}
