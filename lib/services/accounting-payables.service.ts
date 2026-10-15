"use server";

import { prisma } from "@/lib/prisma";
import { registerPurchasePayment, getPaymentTypes } from "@/lib/services/purchases/invoices";
import { revalidatePath } from "next/cache";

export interface PayablePayment {
  id: number;
  amount: number;
  paidAt: string;
  paymentType: {
    id: number;
    name: string;
  };
}

export interface PayableJournalDetail {
  id: number;
  debit: number;
  credit: number;
  description: string | null;
  account: {
    id: number;
    code: string;
    name: string;
  };
}

export interface PayableJournalEntry {
  id: number;
  code: string;
  description: string;
  entryDate: string;
  book: string;
  status: boolean;
  entryDetails: PayableJournalDetail[];
}

export interface PayableOrderItem {
  id: number;
  supplyName: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PayableInvoice {
  id: number;
  voucherType: string;
  series: string;
  number: number;
  voucherLabel: string;
  issuedAt: string;
  createdAt: string;
  subtotal: number;
  igv: number;
  totalAmount: number;
  totalPaid: number;
  pendingBalance: number;
  status: "Pendiente" | "Parcial" | "Pagado";
  daysOpen: number;
  isOverdue: boolean;
  supplier: {
    id: number;
    ruc: string;
    businessName: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
  };
  orderItems: PayableOrderItem[];
  payments: PayablePayment[];
  journalEntries: PayableJournalEntry[];
}

export interface PayablesSummary {
  totalPendingDebt: number;
  totalInvoiced: number;
  totalPaid: number;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
  suppliersWithDebtCount: number;
  overdueCount: number;
  paymentComplianceRate: number;
}

export interface PayablesDataResponse {
  invoices: PayableInvoice[];
  summary: PayablesSummary;
  paymentTypes: { id: number; name: string }[];
}

export async function getAccountingPayables(): Promise<PayablesDataResponse> {
  try {
    const [rawInvoices, rawPaymentTypes] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: { active: true },
        include: {
          supplier: true,
          purchaseOrder: {
            include: {
              items: {
                include: {
                  supply: true,
                },
              },
            },
          },
          payments: {
            include: {
              paymentType: true,
            },
            orderBy: { paidAt: "asc" },
          },
          journalEntries: {
            include: {
              entryDetails: {
                include: {
                  account: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { entryDate: "asc" },
          },
        },
        orderBy: { issuedAt: "desc" },
      }),
      getPaymentTypes(),
    ]);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let totalPendingDebt = 0;
    let totalInvoiced = 0;
    let totalPaidSum = 0;
    let pendingCount = 0;
    let partialCount = 0;
    let paidCount = 0;
    let overdueCount = 0;
    const suppliersWithDebtSet = new Set<number>();

    const invoices: PayableInvoice[] = rawInvoices.map((inv) => {
      const totalAmount = Number(inv.totalAmount);
      const paid = inv.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const pendingBalance = Math.max(0, Math.round((totalAmount - paid) * 100) / 100);

      let status: "Pendiente" | "Parcial" | "Pagado" = "Pendiente";
      if (pendingBalance <= 0.005) {
        status = "Pagado";
        paidCount++;
      } else if (paid > 0.005) {
        status = "Parcial";
        partialCount++;
      } else {
        status = "Pendiente";
        pendingCount++;
      }

      totalInvoiced += totalAmount;
      totalPaidSum += paid;

      const issueDate = new Date(inv.issuedAt);
      issueDate.setHours(0, 0, 0, 0);
      const diffTime = Math.max(0, now.getTime() - issueDate.getTime());
      const daysOpen = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Plazo estándar comercial de 30 días
      const isOverdue = pendingBalance > 0.005 && daysOpen > 30;

      if (pendingBalance > 0.005) {
        totalPendingDebt += pendingBalance;
        suppliersWithDebtSet.add(inv.supplierId);
        if (isOverdue) overdueCount++;
      }

      const orderItems: PayableOrderItem[] = (inv.purchaseOrder?.items ?? []).map((item) => {
        const qty = Number(item.quantityReceived ?? item.quantityOrdered);
        const price = Number(item.unitPrice);
        return {
          id: item.id,
          supplyName: item.supply?.name ?? "Insumo",
          unitOfMeasure: item.supply?.unitOfMeasure ?? "UND",
          quantity: qty,
          unitPrice: price,
          total: Math.round(qty * price * 100) / 100,
        };
      });

      const payments: PayablePayment[] = inv.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        paymentType: {
          id: p.paymentType.id,
          name: p.paymentType.name,
        },
      }));

      const journalEntries: PayableJournalEntry[] = inv.journalEntries.map((je) => ({
        id: je.id,
        code: je.code,
        description: je.description,
        entryDate: je.entryDate.toISOString(),
        book: je.book,
        status: je.status,
        entryDetails: je.entryDetails.map((d) => ({
          id: d.id,
          debit: Number(d.debit),
          credit: Number(d.credit),
          description: d.description,
          account: {
            id: d.account.id,
            code: d.account.code,
            name: d.account.name,
          },
        })),
      }));

      return {
        id: inv.id,
        voucherType: inv.voucherType,
        series: inv.series,
        number: inv.number,
        voucherLabel: `${inv.voucherType} ${inv.series}-${String(inv.number).padStart(4, "0")}`,
        issuedAt: inv.issuedAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        subtotal: Number(inv.subtotal),
        igv: Number(inv.igv),
        totalAmount,
        totalPaid: paid,
        pendingBalance,
        status,
        daysOpen,
        isOverdue,
        supplier: {
          id: inv.supplier.id,
          ruc: inv.supplier.ruc,
          businessName: inv.supplier.businessName,
          contactPerson: inv.supplier.contactPerson,
          phone: inv.supplier.phone,
          email: inv.supplier.email,
        },
        orderItems,
        payments,
        journalEntries,
      };
    });

    const paymentComplianceRate =
      totalInvoiced > 0 ? Math.round((totalPaidSum / totalInvoiced) * 100) : 100;

    return {
      invoices,
      summary: {
        totalPendingDebt: Math.round(totalPendingDebt * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaidSum * 100) / 100,
        pendingCount,
        partialCount,
        paidCount,
        suppliersWithDebtCount: suppliersWithDebtSet.size,
        overdueCount,
        paymentComplianceRate,
      },
      paymentTypes: rawPaymentTypes.map((pt) => ({ id: pt.id, name: pt.name })),
    };
  } catch (error) {
    console.error("Error al obtener cuentas por pagar:", error);
    return {
      invoices: [],
      summary: {
        totalPendingDebt: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        pendingCount: 0,
        partialCount: 0,
        paidCount: 0,
        suppliersWithDebtCount: 0,
        overdueCount: 0,
        paymentComplianceRate: 100,
      },
      paymentTypes: [],
    };
  }
}

export async function payPayableInvoiceAction(
  invoiceId: number,
  paymentTypeId: number,
  amount: number
) {
  if (amount <= 0) {
    throw new Error("El monto a pagar debe ser mayor a 0");
  }

  const result = await registerPurchasePayment(invoiceId, paymentTypeId, amount);

  revalidatePath("/accounting/payables");
  revalidatePath("/accounting/entries");
  revalidatePath("/reports/dashboard");
  revalidatePath("/purchases/list");
  revalidatePath("/purchases/suppliers");

  return result;
}
