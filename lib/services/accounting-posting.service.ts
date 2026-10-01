/**
 * Automatic journal posting for sales and purchases (PCGE / SUNAT academic model).
 *
 * Sale → 5 journal entries:
 *  1. Accounts receivable vs Sales (net of IGV)
 *  2. Accounts receivable vs IGV payable
 *  3. Cash/Banks vs Accounts receivable (collection)
 *  4. Cost of sales vs Merchandise inventory
 *  5. Cost of sales vs Raw materials inventory
 *
 * Purchase voucher:
 *  Contado → 4 entries (insumos + mercaderías + IGV + pago)
 *  Crédito → 3 entries (insumos + mercaderías + IGV); pago al registrar el pago
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const ACCOUNT_CODES = {
  cash: "101",
  banks: "104",
  receivables: "121",
  igvCredit: "167",
  merchandise: "201",
  rawMaterials: "241",
  payables: "421",
  igvPayable: "401",
  sales: "701",
  costOfSales: "691",
} as const;

/** Estimated COGS as % of net sales when there is no recipe/BOM costing. */
const SALE_COST_RATIO = 0.4;
/** Share of COGS charged to merchandise (201) vs raw materials (241). */
const SALE_COST_MERCHANDISE_SHARE = 0.7;

const BOOK_SALES = "Ventas";
const BOOK_PURCHASES = "Compras";
const BOOK_CASH = "Caja y bancos";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function getCodePrefix(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `MISC/${year}/${month}/`;
}

async function nextJournalCode(tx: Tx, date: Date): Promise<string> {
  const prefix = getCodePrefix(date);
  const existing = await tx.journalEntry.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const maxNumber = existing.reduce((highest, entry) => {
    const parsed = Number.parseInt(entry.code.slice(prefix.length), 10);
    return Number.isNaN(parsed) ? highest : Math.max(highest, parsed);
  }, 0);

  for (let n = maxNumber + 1; n <= maxNumber + 80; n++) {
    const candidate = `${prefix}${String(n).padStart(4, "0")}`;
    if (candidate.length > 20) break;
    const clash = await tx.journalEntry.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("No se pudo generar un código de asiento contable.");
}

async function resolveAccountIds(tx: Tx, codes: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(codes)];
  const accounts = await tx.accountingAccount.findMany({
    where: { code: { in: unique }, active: true },
    select: { id: true, code: true },
  });
  const map = new Map(accounts.map((a) => [a.code, a.id]));
  const missing = unique.filter((c) => !map.has(c));
  if (missing.length > 0) {
    throw new Error(
      `Faltan cuentas contables activas en el plan (${missing.join(", ")}). Ejecuta el seed de cuentas.`,
    );
  }
  return map;
}

async function createBalancedEntry(
  tx: Tx,
  input: {
    date: Date;
    description: string;
    book: string;
    responsible?: string;
    observation?: string;
    salesInvoiceId?: number;
    purchaseInvoiceId?: number;
    debitAccountId: number;
    creditAccountId: number;
    amount: number;
    debitLineDescription?: string;
    creditLineDescription?: string;
  },
): Promise<number> {
  const amount = round2(input.amount);
  if (amount <= 0) {
    throw new Error(`Importe de asiento inválido para: ${input.description}`);
  }

  let createdId: number | null = null;
  for (let attempt = 0; attempt < 5 && createdId === null; attempt++) {
    try {
      const entry = await tx.journalEntry.create({
        data: {
          code: await nextJournalCode(tx, input.date),
          entryDate: input.date,
          description: input.description.slice(0, 200),
          book: input.book,
          responsible: input.responsible ?? "Sistema ERP",
          observation: input.observation?.slice(0, 200) ?? null,
          status: true,
          salesInvoiceId: input.salesInvoiceId ?? null,
          purchaseInvoiceId: input.purchaseInvoiceId ?? null,
          entryDetails: {
            create: [
              {
                accountId: input.debitAccountId,
                description: (input.debitLineDescription ?? input.description).slice(0, 200),
                debit: amount,
                credit: 0,
              },
              {
                accountId: input.creditAccountId,
                description: (input.creditLineDescription ?? input.description).slice(0, 200),
                debit: 0,
                credit: amount,
              },
            ],
          },
        },
        select: { id: true },
      });
      createdId = entry.id;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
      if (code !== "P2002") throw err;
    }
  }

  if (createdId === null) {
    throw new Error(`No se pudo registrar el asiento: ${input.description}`);
  }
  return createdId;
}

function pickCashOrBankAccountId(
  accounts: Map<string, number>,
  paymentMethodName: string,
): number {
  const name = (paymentMethodName || "").toLowerCase();
  const isCash = name.includes("efectivo") || name.includes("cash");
  return isCash ? accounts.get(ACCOUNT_CODES.cash)! : accounts.get(ACCOUNT_CODES.banks)!;
}

export interface PostSaleJournalInput {
  salesInvoiceId: number;
  voucherCode: string;
  entryDate?: Date;
  /** Net taxable base (without IGV). */
  subtotal: number;
  igv: number;
  total: number;
  paymentMethodName: string;
  responsible?: string;
}

/**
 * Posts the 5 academic journal entries for a registered sale.
 * Must run inside the same Prisma transaction as the sale voucher.
 */
export async function postSaleJournalEntries(tx: Tx, input: PostSaleJournalInput): Promise<number[]> {
  const subtotal = round2(input.subtotal);
  const igv = round2(input.igv);
  const total = round2(input.total);
  if (subtotal <= 0 || total <= 0) {
    throw new Error("No se pueden generar asientos de venta con totales en cero.");
  }

  const accounts = await resolveAccountIds(tx, [
    ACCOUNT_CODES.cash,
    ACCOUNT_CODES.banks,
    ACCOUNT_CODES.receivables,
    ACCOUNT_CODES.igvPayable,
    ACCOUNT_CODES.sales,
    ACCOUNT_CODES.costOfSales,
    ACCOUNT_CODES.merchandise,
    ACCOUNT_CODES.rawMaterials,
  ]);

  const date = toUtcDateOnly(input.entryDate ?? new Date());
  const ref = input.voucherCode;
  const ids: number[] = [];

  // 1) Venta neta
  ids.push(
    await createBalancedEntry(tx, {
      date,
      description: `Venta neta ${ref}`,
      book: BOOK_SALES,
      responsible: input.responsible,
      salesInvoiceId: input.salesInvoiceId,
      observation: "Asiento 1/5 — Reconocimiento de ingreso (base imponible)",
      debitAccountId: accounts.get(ACCOUNT_CODES.receivables)!,
      creditAccountId: accounts.get(ACCOUNT_CODES.sales)!,
      amount: subtotal,
      debitLineDescription: "Cuentas por cobrar por venta",
      creditLineDescription: "Ventas de mercaderías / servicios",
    }),
  );

  // 2) IGV débito fiscal
  ids.push(
    await createBalancedEntry(tx, {
      date,
      description: `IGV ventas ${ref}`,
      book: BOOK_SALES,
      responsible: input.responsible,
      salesInvoiceId: input.salesInvoiceId,
      observation: "Asiento 2/5 — IGV débito fiscal (SUNAT 18%)",
      debitAccountId: accounts.get(ACCOUNT_CODES.receivables)!,
      creditAccountId: accounts.get(ACCOUNT_CODES.igvPayable)!,
      amount: igv > 0 ? igv : round2(total - subtotal),
      debitLineDescription: "IGV facturado por cobrar",
      creditLineDescription: "Tributos por pagar - IGV",
    }),
  );

  // 3) Cobro
  const cashAccountId = pickCashOrBankAccountId(accounts, input.paymentMethodName);
  ids.push(
    await createBalancedEntry(tx, {
      date,
      description: `Cobro venta ${ref}`,
      book: BOOK_CASH,
      responsible: input.responsible,
      salesInvoiceId: input.salesInvoiceId,
      observation: `Asiento 3/5 — Cobro (${input.paymentMethodName || "pago"})`,
      debitAccountId: cashAccountId,
      creditAccountId: accounts.get(ACCOUNT_CODES.receivables)!,
      amount: total,
      debitLineDescription: "Ingreso a caja / bancos",
      creditLineDescription: "Cancelación de cuenta por cobrar",
    }),
  );

  // Estimated COGS split across merchandise + raw materials (asientos 4 y 5)
  const totalCost = round2(subtotal * SALE_COST_RATIO);
  const merchandiseCost = round2(totalCost * SALE_COST_MERCHANDISE_SHARE);
  const rawMaterialsCost = round2(totalCost - merchandiseCost);

  // 4) Costo de ventas — mercaderías
  if (merchandiseCost > 0) {
    ids.push(
      await createBalancedEntry(tx, {
        date,
        description: `Costo de ventas (mercadería) ${ref}`,
        book: BOOK_SALES,
        responsible: input.responsible,
        salesInvoiceId: input.salesInvoiceId,
        observation: "Asiento 4/5 — Costo de ventas y baja de mercaderías",
        debitAccountId: accounts.get(ACCOUNT_CODES.costOfSales)!,
        creditAccountId: accounts.get(ACCOUNT_CODES.merchandise)!,
        amount: merchandiseCost,
        debitLineDescription: "Costo de ventas de mercaderías",
        creditLineDescription: "Salida de inventario de mercaderías",
      }),
    );
  }

  // 5) Costo de ventas — materias primas / insumos
  if (rawMaterialsCost > 0) {
    ids.push(
      await createBalancedEntry(tx, {
        date,
        description: `Costo de ventas (insumos) ${ref}`,
        book: BOOK_SALES,
        responsible: input.responsible,
        salesInvoiceId: input.salesInvoiceId,
        observation: "Asiento 5/5 — Costo de ventas y consumo de materias primas",
        debitAccountId: accounts.get(ACCOUNT_CODES.costOfSales)!,
        creditAccountId: accounts.get(ACCOUNT_CODES.rawMaterials)!,
        amount: rawMaterialsCost,
        debitLineDescription: "Costo de ventas — consumo de insumos",
        creditLineDescription: "Salida de inventario de materias primas",
      }),
    );
  }

  return ids;
}

export interface PostPurchaseJournalInput {
  purchaseInvoiceId: number;
  voucherLabel: string;
  entryDate?: Date;
  subtotal: number;
  igv: number;
  total: number;
  /** Contado posts payment immediately; Credito only posts purchase + IGV. */
  paymentCondition: "Contado" | "Credito";
  paymentMethodName?: string;
  responsible?: string;
}

/**
 * Posts purchase journal entries when a supplier voucher is registered.
 * Contado → compra + IGV + pago (+ split inventario if needed to mirror 5-step teaching).
 * Crédito → compra + IGV (pago al registrar el pago).
 */
export async function postPurchaseJournalEntries(
  tx: Tx,
  input: PostPurchaseJournalInput,
): Promise<number[]> {
  const subtotal = round2(input.subtotal);
  const igv = round2(input.igv);
  const total = round2(input.total);
  if (subtotal <= 0 || total <= 0) {
    throw new Error("No se pueden generar asientos de compra con totales en cero.");
  }

  const accounts = await resolveAccountIds(tx, [
    ACCOUNT_CODES.cash,
    ACCOUNT_CODES.banks,
    ACCOUNT_CODES.igvCredit,
    ACCOUNT_CODES.merchandise,
    ACCOUNT_CODES.rawMaterials,
    ACCOUNT_CODES.payables,
  ]);

  const date = toUtcDateOnly(input.entryDate ?? new Date());
  const ref = input.voucherLabel;
  const ids: number[] = [];

  // Split purchase into raw materials (majority) + merchandise (minor) → asientos 1 y 2
  const rawShare = round2(subtotal * 0.8);
  const merchShare = round2(subtotal - rawShare);

  // 1) Compra materias primas
  if (rawShare > 0) {
    ids.push(
      await createBalancedEntry(tx, {
        date,
        description: `Compra insumos ${ref}`,
        book: BOOK_PURCHASES,
        responsible: input.responsible,
        purchaseInvoiceId: input.purchaseInvoiceId,
        observation: "Asiento 1 — Compra de materias primas / insumos",
        debitAccountId: accounts.get(ACCOUNT_CODES.rawMaterials)!,
        creditAccountId: accounts.get(ACCOUNT_CODES.payables)!,
        amount: rawShare,
        debitLineDescription: "Ingreso de materias primas a almacén",
        creditLineDescription: "Cuentas por pagar comerciales",
      }),
    );
  }

  // 2) Compra mercaderías
  if (merchShare > 0) {
    ids.push(
      await createBalancedEntry(tx, {
        date,
        description: `Compra mercaderías ${ref}`,
        book: BOOK_PURCHASES,
        responsible: input.responsible,
        purchaseInvoiceId: input.purchaseInvoiceId,
        observation: "Asiento 2 — Compra de mercaderías",
        debitAccountId: accounts.get(ACCOUNT_CODES.merchandise)!,
        creditAccountId: accounts.get(ACCOUNT_CODES.payables)!,
        amount: merchShare,
        debitLineDescription: "Ingreso de mercaderías a almacén",
        creditLineDescription: "Cuentas por pagar comerciales",
      }),
    );
  }

  // 3) IGV crédito fiscal
  if (igv > 0) {
    ids.push(
      await createBalancedEntry(tx, {
        date,
        description: `IGV compras ${ref}`,
        book: BOOK_PURCHASES,
        responsible: input.responsible,
        purchaseInvoiceId: input.purchaseInvoiceId,
        observation: "Asiento 3 — IGV crédito fiscal (SUNAT)",
        debitAccountId: accounts.get(ACCOUNT_CODES.igvCredit)!,
        creditAccountId: accounts.get(ACCOUNT_CODES.payables)!,
        amount: igv,
        debitLineDescription: "Tributos por acreditar - IGV",
        creditLineDescription: "IGV en cuentas por pagar",
      }),
    );
  }

  // 4) Pago al contado (cancela toda la obligación)
  if (input.paymentCondition === "Contado") {
    const cashAccountId = pickCashOrBankAccountId(
      accounts,
      input.paymentMethodName || "Efectivo",
    );
    ids.push(
      await createBalancedEntry(tx, {
        date,
        description: `Pago compra ${ref}`,
        book: BOOK_CASH,
        responsible: input.responsible,
        purchaseInvoiceId: input.purchaseInvoiceId,
        observation: "Asiento 4 — Cancelación de cuenta por pagar (contado)",
        debitAccountId: accounts.get(ACCOUNT_CODES.payables)!,
        creditAccountId: cashAccountId,
        amount: total,
        debitLineDescription: "Cancelación de cuentas por pagar",
        creditLineDescription: "Salida de caja / bancos",
      }),
    );
  }

  return ids;
}

export interface PostPurchasePaymentJournalInput {
  purchaseInvoiceId: number;
  voucherLabel: string;
  amount: number;
  paymentMethodName: string;
  entryDate?: Date;
  responsible?: string;
}

/** Posts payment journal entry for a credit purchase. */
export async function postPurchasePaymentJournalEntry(
  tx: Tx,
  input: PostPurchasePaymentJournalInput,
): Promise<number> {
  const amount = round2(input.amount);
  if (amount <= 0) throw new Error("Monto de pago inválido para asiento contable.");

  const accounts = await resolveAccountIds(tx, [
    ACCOUNT_CODES.cash,
    ACCOUNT_CODES.banks,
    ACCOUNT_CODES.payables,
  ]);
  const date = toUtcDateOnly(input.entryDate ?? new Date());
  const cashAccountId = pickCashOrBankAccountId(accounts, input.paymentMethodName);

  return createBalancedEntry(tx, {
    date,
    description: `Pago compra a crédito ${input.voucherLabel}`,
    book: BOOK_CASH,
    responsible: input.responsible,
    purchaseInvoiceId: input.purchaseInvoiceId,
    observation: "Pago de comprobante de compra (crédito)",
    debitAccountId: accounts.get(ACCOUNT_CODES.payables)!,
    creditAccountId: cashAccountId,
    amount,
    debitLineDescription: "Cancelación parcial/total de cuentas por pagar",
    creditLineDescription: "Salida de caja / bancos",
  });
}

/** Convenience helper outside an existing transaction (tests / rare callers). */
export async function postSaleJournalEntriesStandalone(
  input: PostSaleJournalInput,
): Promise<number[]> {
  return prisma.$transaction((tx) => postSaleJournalEntries(tx, input));
}
