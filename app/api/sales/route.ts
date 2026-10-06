import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDailySalesSummary } from "@/lib/utils/sales-helpers";
import { postSaleJournalEntries } from "@/lib/services/accounting-posting.service";

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
  id_tipo_pago?: number;
  amount?: number;
  monto?: number;
}

interface RegisterSaleInput {
  orderId?: number;
  id_pedido?: number;
  paymentTypeId?: number;
  id_tipo_pago?: number;
  payments?: SplitPaymentInput[];
  pagos?: SplitPaymentInput[];
  voucherType?: "Boleta" | "Factura" | "Ticket";
  tipo_comprobante?: "Boleta" | "Factura" | "Ticket";
  customer?: {
    documentNumber?: string;
    nro_doc?: string;
    firstName?: string;
    nombre?: string;
    personType?: "Natural" | "Legal" | "Juridico";
    tipo_persona?: "Natural" | "Legal" | "Juridico";
    phone?: string;
    telefono?: string;
  };
  cliente?: RegisterSaleInput["customer"];
  amountReceived?: number;
  monto_recibido?: number;
  gateway?: {
    provider?: string;
    mode?: "tap_to_pay" | "qr" | "manual";
    operationId?: string;
  };
  pasarela?: {
    proveedor?: string;
    modo?: "tap_to_pay" | "qr" | "manual";
    operacion_id?: string;
  };
}

function normalizePersonType(value: unknown): PersonTypeValue {
  if (value === "Legal" || value === "Juridico") return "Legal";
  return "Natural";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RegisterSaleInput | null;
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Datos de venta no válidos." }, { status: 400 });
    }

    const orderId = Number(body.orderId ?? body.id_pedido);
    const paymentTypeId = body.paymentTypeId ?? body.id_tipo_pago;
    const voucherType = body.voucherType ?? body.tipo_comprobante;
    const customerInput = body.customer ?? body.cliente;
    const amountReceived = body.amountReceived ?? body.monto_recibido;
    const gateway = body.gateway ?? (body.pasarela
      ? {
          provider: body.pasarela.proveedor,
          mode: body.pasarela.modo,
          operationId: body.pasarela.operacion_id,
        }
      : undefined);

    if (!orderId || Number.isNaN(orderId)) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const splitPayments = body.payments ?? body.pagos;
    const isSplitPayment = Array.isArray(splitPayments) && splitPayments.length > 0;

    if (!isSplitPayment && (!paymentTypeId || Number.isNaN(Number(paymentTypeId)))) {
      return Response.json({ error: "Debe seleccionar un método de pago válido." }, { status: 400 });
    }

    let paymentType: { id: number; name: string; active: boolean } | null = null;
    const paymentsList: Array<{ paymentTypeId: number; amount: number; name: string }> = [];

    if (isSplitPayment) {
      const paymentTypesDb = await prisma.paymentType.findMany({ where: { active: true } });
      const paymentTypesMap = new Map(paymentTypesDb.map((t) => [t.id, t]));
      for (const p of splitPayments!) {
        const idTP = Number(p.paymentTypeId ?? p.id_tipo_pago);
        const amountNum = Math.round(Number(p.amount ?? p.monto) * 100) / 100;
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
        items: { include: { dish: true } }
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
    const customerDoc = (customerInput?.documentNumber ?? customerInput?.nro_doc)?.trim() || "00000000";
    const customerName = (customerInput?.firstName ?? customerInput?.nombre)?.trim() || "CLIENTE GENERAL";
    const rawPersonType = customerInput?.personType ?? customerInput?.tipo_persona;
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
          phone: (customerInput?.phone ?? customerInput?.telefono)?.trim() || null,
          active: true
        }
      });
      customerId = newCustomer.id;
    }

    const docType = voucherType === "Factura" ? "Factura" : voucherType === "Boleta" ? "Boleta" : "Boleta";
    const series = docType === "Factura" ? "F001" : "B001";

    const lastVoucher = await prisma.salesInvoice.findFirst({
      where: { voucherType: docType, series },
      orderBy: { number: "desc" }
    });
    const sequentialNumber = (lastVoucher?.number ?? 0) + 1;

    const transaction = await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.create({
        data: {
          orderId: order.id,
          customerId,
          voucherType: docType,
          series,
          number: sequentialNumber,
          subtotal: taxableSubtotal,
          igv: calculatedIgv,
          totalAmount: roundedTotal,
          status: "Issued",
          issuedAt: new Date()
        }
      });

      if (isSplitPayment) {
        for (const p of paymentsList) {
          await tx.salesPayment.create({
            data: {
              salesInvoiceId: invoice.id,
              paymentTypeId: p.paymentTypeId,
              amount: p.amount,
              paidAt: new Date()
            }
          });
        }
      } else {
        await tx.salesPayment.create({
          data: {
            salesInvoiceId: invoice.id,
            paymentTypeId: paymentType!.id,
            amount: roundedTotal,
            paidAt: new Date()
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

      const paymentMethodNameForJournal = isSplitPayment
        ? paymentsList.map((p) => p.name).join(" + ")
        : (paymentType?.name ?? "Efectivo");

      const journalEntryIds = await postSaleJournalEntries(tx, {
        salesInvoiceId: invoice.id,
        voucherCode: `${series}-${String(sequentialNumber).padStart(6, "0")}`,
        entryDate: invoice.issuedAt,
        subtotal: taxableSubtotal,
        igv: calculatedIgv,
        total: roundedTotal,
        paymentMethodName: paymentMethodNameForJournal,
        responsible: "Caja / Ventas",
      });

      return { invoice, journalEntryIds };
    });

    const associatedTable = order.tables[0]?.table ?? null;
    const change = amountReceived ? Math.max(0, Math.round((amountReceived - roundedTotal) * 100) / 100) : 0;

    const paymentMethodName = isSplitPayment
      ? `Pago en Partes (${paymentsList.map((p) => `${p.name}: S/ ${p.amount.toFixed(2)}`).join(" + ")})`
      : (paymentType?.name ?? "Efectivo");

    return Response.json(
      {
        message: "Venta registrada, pedido cerrado, mesa liberada y asientos contables generados.",
        journalEntriesCount: transaction.journalEntryIds.length,
        journalEntryIds: transaction.journalEntryIds,
        invoice: {
          id: transaction.invoice.id,
          voucherType: docType,
          series,
          number: sequentialNumber,
          fullCode: `${series}-${String(sequentialNumber).padStart(6, "0")}`,
          issuedAt: transaction.invoice.issuedAt.toISOString(),
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
          items: order.items.map((d) => ({
            name: d.dish.name,
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
  } catch (error) {
    console.error("[api/sales] Error al registrar venta:", error);
    return Response.json(
      { error: "No se pudo completar el cobro y cierre de la venta." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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
        order: {
          include: {
            tables: {
              include: {
                table: true,
              },
            },
            items: {
              include: {
                dish: true,
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
      const associatedTable = c.order?.tables[0]?.table;
      const paymentMethod = c.payments[0]?.paymentType?.name || "Efectivo";

      return {
        id: c.id,
        orderId: c.orderId,
        voucherType: c.voucherType as "Boleta" | "Factura" | "Ticket",
        series: c.series,
        number: c.number,
        fullCode: `${c.series}-${String(c.number).padStart(6, "0")}`,
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
        items:
          c.order?.items.map((d) => ({
            name: d.dish.name,
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
