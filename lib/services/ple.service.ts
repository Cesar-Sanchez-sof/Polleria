/**
 * Server-side loader of the PLE snapshot: reads (read-only) the invoices, journal entries and
 * accounts of one month and converts them to the plain data the generators in `lib/ple` use.
 */
import { prisma } from "@/lib/prisma";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { monthRange } from "@/lib/ple/format";
import type {
  PleSnapshot,
  SnapshotJournalEntry,
  SnapshotParty,
  SnapshotPurchaseInvoice,
  SnapshotSalesInvoice,
} from "@/lib/ple/snapshot";
import { getRestaurantGlobalConfig } from "./restaurant-config.service";

function fullName(firstName: string, lastName: string | null): string {
  return [lastName, firstName].filter(Boolean).join(" ").trim();
}

export async function loadPleSnapshot(year: number, month: number): Promise<PleSnapshot> {
  const { from, to } = monthRange(year, month);
  const fromDate = parseUtcDate(from);
  const toDate = parseUtcDate(to);
  const restaurant = (await getRestaurantGlobalConfig()).restaurant;

  // Entries dated in the month, plus the ones that support invoices issued in it.
  const monthEntries = await prisma.journalEntry.findMany({
    where: { entryDate: { gte: fromDate, lte: toDate } },
    orderBy: [{ entryDate: "asc" }, { id: "asc" }],
    include: {
      entryDetails: {
        orderBy: { id: "asc" },
        include: { account: { select: { code: true } } },
      },
    },
  });

  const salesIds = new Set(
    monthEntries.map((entry) => entry.salesInvoiceId).filter((id): id is number => id !== null)
  );
  const purchaseIds = new Set(
    monthEntries
      .map((entry) => entry.purchaseInvoiceId)
      .filter((id): id is number => id !== null)
  );

  const [salesInvoices, purchaseInvoices, accounts] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: {
        OR: [{ issuedAt: { gte: fromDate, lte: toDate } }, { id: { in: [...salesIds] } }],
      },
      include: { customer: true },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        OR: [{ issuedAt: { gte: fromDate, lte: toDate } }, { id: { in: [...purchaseIds] } }],
      },
      include: { supplier: true },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
    }),
    prisma.accountingAccount.findMany({ select: { code: true, name: true } }),
  ]);

  // Entries of invoices issued in the month but dated outside it (needed to resolve the CUO).
  const knownEntryIds = new Set(monthEntries.map((entry) => entry.id));
  const linkedElsewhere = await prisma.journalEntry.findMany({
    where: {
      id: { notIn: [...knownEntryIds] },
      OR: [
        { salesInvoiceId: { in: salesInvoices.map((invoice) => invoice.id) } },
        { purchaseInvoiceId: { in: purchaseInvoices.map((invoice) => invoice.id) } },
      ],
    },
    orderBy: [{ entryDate: "asc" }, { id: "asc" }],
    include: {
      entryDetails: {
        orderBy: { id: "asc" },
        include: { account: { select: { code: true } } },
      },
    },
  });

  const journalEntries: SnapshotJournalEntry[] = [...monthEntries, ...linkedElsewhere].map(
    (entry) => ({
      id: entry.id,
      code: entry.code,
      date: formatDateToIso(entry.entryDate),
      description: entry.description,
      active: entry.status,
      salesInvoiceId: entry.salesInvoiceId,
      purchaseInvoiceId: entry.purchaseInvoiceId,
      lines: entry.entryDetails.map((line) => ({
        accountCode: line.account.code,
        description: line.description,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    })
  );

  return {
    taxpayer: { ruc: (restaurant.ruc ?? "").trim(), name: restaurant.name },
    period: { year, month },
    salesInvoices: salesInvoices.map<SnapshotSalesInvoice>((invoice) => ({
      id: invoice.id,
      voucherType: invoice.voucherType,
      series: invoice.series,
      number: invoice.number,
      issuedAt: formatDateToIso(invoice.issuedAt),
      subtotal: Number(invoice.subtotal),
      igv: Number(invoice.igv),
      total: Number(invoice.totalAmount),
      status: invoice.status,
      customer: invoice.customer
        ? ({
            documentNumber: invoice.customer.documentNumber,
            name: fullName(invoice.customer.firstName, invoice.customer.lastName),
          } satisfies SnapshotParty)
        : null,
    })),
    purchaseInvoices: purchaseInvoices.map<SnapshotPurchaseInvoice>((invoice) => ({
      id: invoice.id,
      voucherType: invoice.voucherType,
      series: invoice.series,
      number: invoice.number,
      issuedAt: formatDateToIso(invoice.issuedAt),
      subtotal: Number(invoice.subtotal),
      igv: Number(invoice.igv),
      total: Number(invoice.totalAmount),
      active: invoice.active,
      supplier: { documentNumber: invoice.supplier.ruc, name: invoice.supplier.businessName },
    })),
    journalEntries,
    accounts,
  };
}
