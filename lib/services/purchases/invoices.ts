"use server";

import { prisma } from "@/lib/prisma";
import {
  postPurchaseJournalEntries,
  postPurchasePaymentJournalEntry,
} from "@/lib/services/accounting-posting.service";

export interface PurchaseVoucherInput {
  supplierId: number;
  receiptId: number;
  voucherType: string; // 'Factura' | 'Boleta' | 'Guía'
  series: string;
  number: number;
  issuedAt?: Date | string | null;
  paymentCondition: "Contado" | "Credito";
  paymentTypeId?: number;
}

export async function getReceiptsWithoutVoucher() {
  try {
    return await prisma.purchaseReceipt.findMany({
      where: {
        invoices: {
          none: {},
        },
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            purchaseOrderItem: {
              include: {
                supply: true,
              },
            },
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
  if (!data.supplierId) {
    throw new Error("Debe seleccionar un proveedor");
  }
  if (!data.receiptId) {
    throw new Error("Debe seleccionar una recepción de compra");
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

  return await prisma.$transaction(async (tx) => {
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

    const receipt = await tx.purchaseReceipt.findUnique({
      where: { id: data.receiptId },
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
      },
    });
    if (!receipt) {
      throw new Error("Recepción de compra no encontrada");
    }

    let subtotal = 0;
    for (const d of receipt.items) {
      const qty = Number(d.quantityReceived);
      const price = Number(d.purchaseOrderItem.unitPrice);
      subtotal += qty * price;
    }
    const igv = Math.round(subtotal * 0.18 * 100) / 100;
    const totalAmount = subtotal + igv;

    const issueDate = data.issuedAt ? new Date(data.issuedAt) : new Date();

    const voucher = await tx.purchaseInvoice.create({
      data: {
        supplierId: data.supplierId,
        receiptId: data.receiptId,
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
}

export async function getPurchaseVouchers() {
  try {
    const invoices = await prisma.purchaseInvoice.findMany({
      include: {
        supplier: true,
        receipt: {
          include: {
            items: {
              include: {
                purchaseOrderItem: {
                  include: {
                    supply: true,
                  },
                },
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
      const totalPagado = c.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const montoTotal = Number(c.totalAmount);
      let estadoPago: "Pendiente" | "Parcial" | "Pagado" = "Pendiente";
      if (totalPagado >= montoTotal && montoTotal > 0) {
        estadoPago = "Pagado";
      } else if (totalPagado > 0) {
        estadoPago = "Parcial";
      }

      return {
        ...c,
        totalPagado,
        saldoPendiente: Math.max(0, montoTotal - totalPagado),
        estadoPago,
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

  return await prisma.$transaction(async (tx) => {
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

    return { ...payment, journalEntryId };
  });
}

export async function getPaymentTypes() {
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
