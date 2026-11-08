"use server";

import { prisma } from "@/lib/prisma";
import {
  postPurchaseJournalEntries,
  postPurchasePaymentJournalEntry,
} from "@/lib/services/accounting-posting.service";
import { requirePermission } from "@/lib/auth/permissions";
import { auditPurchase, plain } from "./purchase-audit";

export interface PurchaseVoucherInput {
  supplierId: number;
  purchaseOrderId?: number;
  receiptId?: number; // Backwards-compatible alias for purchaseOrderId
  voucherType: string; // 'Factura' | 'Boleta' | 'Guía'
  series: string;
  number: number;
  issuedAt?: Date | string | null;
  paymentCondition: "Contado" | "Credito";
  paymentTypeId?: number;
}

export async function getReceiptsWithoutVoucher() {
  await requirePermission("compras.ver");
  try {
    return await prisma.purchaseOrder.findMany({
      where: {
        invoices: {
          none: {},
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { receivedAt: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener recepciones sin comprobante:", error);
    return [];
  }
}

export async function createPurchaseVoucher(data: PurchaseVoucherInput) {
  const session = await requirePermission("compras.crear");
  const purchaseOrderId = data.purchaseOrderId || data.receiptId;
  if (!data.supplierId) {
    throw new Error("Debe seleccionar un proveedor");
  }
  if (!purchaseOrderId) {
    throw new Error("Debe seleccionar una orden de compra");
  }
  if (!data.voucherType || data.voucherType.trim() === "") {
    throw new Error("El tipo de comprobante es obligatorio");
  }
  if (!data.series || data.series.trim().length === 0) {
    throw new Error("La serie del comprobante es obligatoria");
  }
  if (!data.number || data.number <= 0) {
    throw new Error("El número de comprobante es obligatorio");
  }
  if (data.paymentCondition === "Contado" && !data.paymentTypeId) {
    throw new Error("Debe seleccionar el tipo de pago para venta al contado");
  }

  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.purchaseInvoice.findFirst({
      where: {
        supplierId: data.supplierId,
        voucherType: data.voucherType.trim(),
        series: data.series.trim(),
        number: Number(data.number),
      },
    });
    if (duplicate) {
      throw new Error(`El comprobante ${data.voucherType} ${data.series}-${data.number} ya existe para este proveedor`);
    }

    const order = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
      },
    });
    if (!order) {
      throw new Error("Orden de compra no encontrada");
    }

    let subtotal = 0;
    for (const d of order.items) {
      const qty = Number(d.quantityReceived ?? d.quantityOrdered);
      const price = Number(d.unitPrice);
      subtotal += qty * price;
    }
    const igv = Math.round(subtotal * 0.18 * 100) / 100;
    const totalAmount = subtotal + igv;

    const issueDate = data.issuedAt ? new Date(data.issuedAt) : new Date();

    const voucher = await tx.purchaseInvoice.create({
      data: {
        supplierId: data.supplierId,
        purchaseOrderId: purchaseOrderId,
        voucherType: data.voucherType.trim(),
        series: data.series.trim(),
        number: Number(data.number),
        issuedAt: issueDate,
        subtotal,
        igv,
        totalAmount,
        active: true,
      },
    });

    let paymentMethodName = "Efectivo";
    if (data.paymentCondition === "Contado" && data.paymentTypeId) {
      const paymentType = await tx.paymentType.findUnique({
        where: { id: data.paymentTypeId },
      });
      paymentMethodName = paymentType?.name || "Efectivo";

      await tx.purchasePayment.create({
        data: {
          purchaseInvoiceId: voucher.id,
          paymentTypeId: data.paymentTypeId,
          amount: totalAmount,
          paidAt: new Date(),
        },
      });
    }

    const voucherLabel = `${data.voucherType.trim()} ${data.series.trim()}-${data.number}`;
    const journalEntryIds = await postPurchaseJournalEntries(tx, {
      purchaseInvoiceId: voucher.id,
      voucherLabel,
      entryDate: issueDate,
      subtotal,
      igv,
      total: totalAmount,
      paymentCondition: data.paymentCondition,
      paymentMethodName,
      responsible: "Compras",
    });

    return { ...voucher, journalEntryIds };
  });

  await auditPurchase(session, {
    action: "CREATE",
    entity: "ComprobanteCompra",
    entityId: result.id,
    description: `Registró el comprobante ${result.voucherType} ${result.series}-${result.number} de la orden #${purchaseOrderId}`,
    details: {
      after: plain({
        purchase_order_id: purchaseOrderId,
        supplier_id: result.supplierId,
        total: result.totalAmount,
        payment_condition: data.paymentCondition,
      }),
    },
  });
  return result;
}

export async function getPurchaseVouchers() {
  await requirePermission("compras.ver");
  try {
    const invoices = await prisma.purchaseInvoice.findMany({
      include: {
        supplier: true,
        purchaseOrder: {
          include: {
            employee: true,
            receivedBy: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        payments: {
          include: {
            paymentType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((c) => {
      const totalPaid = c.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalAmount = Number(c.totalAmount);
      let paymentStatus: "Pendiente" | "Parcial" | "Pagado" = "Pendiente";
      if (totalPaid >= totalAmount && totalAmount > 0) {
        paymentStatus = "Pagado";
      } else if (totalPaid > 0) {
        paymentStatus = "Parcial";
      }

      return {
        ...c,
        totalPaid,
        pendingBalance: Math.max(0, totalAmount - totalPaid),
        paymentStatus,
      };
    });
  } catch (error) {
    console.error("Error al obtener comprobantes de compra:", error);
    return [];
  }
}

export async function registerPurchasePayment(
  purchaseInvoiceId: number,
  paymentTypeId: number,
  amount: number
) {
  const session = await requirePermission("compras.editar");
  if (amount <= 0) {
    throw new Error("El monto del pago debe ser mayor a 0");
  }
  if (!paymentTypeId) {
    throw new Error("Debe seleccionar un tipo de pago");
  }

  const voucher = await prisma.purchaseInvoice.findUnique({
    where: { id: purchaseInvoiceId },
    include: { payments: true },
  });
  if (!voucher) {
    throw new Error("Comprobante de compra no encontrado");
  }

  const currentTotalPaid = voucher.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingBalance = Number(voucher.totalAmount) - currentTotalPaid;

  if (amount > pendingBalance + 0.01) {
    throw new Error(`El monto supera el saldo pendiente (S/ ${pendingBalance.toFixed(2)})`);
  }

  const paid = await prisma.$transaction(async (tx) => {
    const payment = await tx.purchasePayment.create({
      data: {
        purchaseInvoiceId,
        paymentTypeId,
        amount,
        paidAt: new Date(),
      },
    });

    const paymentType = await tx.paymentType.findUnique({
      where: { id: paymentTypeId },
    });

    const voucherLabel = `${voucher.voucherType} ${voucher.series}-${voucher.number}`;
    const journalEntryId = await postPurchasePaymentJournalEntry(tx, {
      purchaseInvoiceId,
      voucherLabel,
      amount,
      paymentMethodName: paymentType?.name || "Efectivo",
      responsible: "Compras",
    });

    return JSON.parse(
      JSON.stringify({
        ...payment,
        amount: Number(payment.amount),
        journalEntryId,
      })
    );
  });

  await auditPurchase(session, {
    action: "CREATE",
    entity: "PagoCompra",
    entityId: paid?.id ?? null,
    description: `Registró un pago de S/ ${amount.toFixed(2)} al comprobante ${voucher.voucherType} ${voucher.series}-${voucher.number}`,
    details: {
      before: { pending_balance: Math.round(pendingBalance * 100) / 100 },
      after: { amount, payment_type_id: paymentTypeId, pending_balance: Math.round((pendingBalance - amount) * 100) / 100 },
    },
  });
  return paid;
}

export async function getPaymentTypes() {
  await requirePermission(["compras.ver", "compras.crear"]);
  try {
    return await prisma.paymentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener tipos de pago:", error);
    return [];
  }
}


/** Devuelve los comprobantes de compra locales formateados para cotejo/conciliación SIRE. */
export async function listLocalPurchasesForReconciliation() {
  await requirePermission("compras.ver");
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { active: true },
    select: {
      id: true,
      voucherType: true,
      series: true,
      number: true,
      issuedAt: true,
      totalAmount: true,
      supplier: {
        select: {
          ruc: true,
          businessName: true,
        },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    voucherType: inv.voucherType,
    series: inv.series,
    number: String(inv.number),
    issuedAt: inv.issuedAt ? inv.issuedAt.toISOString().slice(0, 10) : "",
    totalAmount: Number(inv.totalAmount),
    supplierDocument: inv.supplier?.ruc ?? "",
    supplierName: inv.supplier?.businessName ?? "",
  }));
}
