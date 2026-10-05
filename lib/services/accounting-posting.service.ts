/**
 * Automatic journal posting for sales and purchases (PCGE / SUNAT academic model).
 *
 * Sale → 3 journal entries:
 *  1. Provisión de la venta: 12 (DEBE) / 40 IGV + 70 Ventas (HABER)
 *  2. Costo de ventas: 69 (DEBE) / 20 Inventario (HABER)
 *  3. Cobro: 10 Caja/Bancos (DEBE) / 12 (HABER)
 *
 * Purchase voucher → 3 journal entries:
 *  1. Provisión de la compra: 60 Compras + 40 IGV crédito (DEBE) / 42 Cuentas por pagar (HABER)
 *  2. Destino / ingreso al almacén: 20 Inventario (DEBE) / 61 Variación de inventarios (HABER)
 *  3. Pago (solo Contado o al registrar el pago en crédito): 42 (DEBE) / 10 Caja/Bancos (HABER)
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const ACCOUNT_CODES = {
  cash: "101",
  banks: "104",
  receivables: "121",
  igvPayable: "401",
  merchandise: "201",
  rawMaterials: "241",
  purchases: "601",       // Compras (Elemento 6)
  inventoryVariation: "611", // Variación de inventarios (Elemento 6 — cuenta correctora)
  payables: "421",
  igvCredit: "167",       // IGV crédito fiscal (Elemento 1)
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

  // 1) Provisión de la venta (Facturación) – registra derecho de cobro, IGV y venta neta en una sola partida
  const provisionEntry = await tx.journalEntry.create({
    data: {
      code: await nextJournalCode(tx, date),
      entryDate: date,
      description: `Provisión de la venta ${ref}`,
      book: BOOK_SALES,
      responsible: input.responsible,
      salesInvoiceId: input.salesInvoiceId,
      observation: "Asiento 1/5 — Provisión de la venta (incluye IGV y venta neta)",
      status: true,
      entryDetails: {
        create: [
          {
            accountId: accounts.get(ACCOUNT_CODES.receivables)!,
            description: "Cuentas por cobrar comerciales – total venta (incluye IGV)",
            debit: total,
            credit: 0,
          },
          {
            accountId: accounts.get(ACCOUNT_CODES.igvPayable)!,
            description: "IGV por pagar",
            debit: 0,
            credit: igv,
          },
          {
            accountId: accounts.get(ACCOUNT_CODES.sales)!,
            description: "Ventas netas",
            debit: 0,
            credit: subtotal,
          },
        ],
      },
    },
    select: { id: true },
  });
  ids.push(provisionEntry.id);

  // 2) Cobro
  const cashAccountId = pickCashOrBankAccountId(accounts, input.paymentMethodName);
  ids.push(
    await createBalancedEntry(tx, {
      date,
      description: `Cobro venta ${ref}`,
      book: BOOK_CASH,
      responsible: input.responsible,
      salesInvoiceId: input.salesInvoiceId,
      observation: `Asiento 2/5 — Cobro (${input.paymentMethodName || "pago"})`,
      debitAccountId: cashAccountId,
      creditAccountId: accounts.get(ACCOUNT_CODES.receivables)!,
      amount: total,
      debitLineDescription: "Ingreso a caja / bancos",
      creditLineDescription: "Cancelación de cuenta por cobrar",
    })
  );

  // 3) Costo de ventas — mercaderías y materias primas (asientos 4 y 5)
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
      })
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
      })
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
    ACCOUNT_CODES.purchases,
    ACCOUNT_CODES.igvCredit,
    ACCOUNT_CODES.merchandise,
    ACCOUNT_CODES.inventoryVariation,
    ACCOUNT_CODES.payables,
  ]);

  const date = toUtcDateOnly(input.entryDate ?? new Date());
  const ref = input.voucherLabel;
  const ids: number[] = [];

  // -----------------------------------------------------------------------
  // 1) Provisión de la compra (Factura del proveedor)
  //    DEBE: 60 Compras (valor neto) + 40 IGV crédito fiscal
  //    HABER: 42 Cuentas por pagar comerciales (precio total)
  // -----------------------------------------------------------------------
  const provisionPurchaseEntry = await tx.journalEntry.create({
    data: {
      code: await nextJournalCode(tx, date),
      entryDate: date,
      description: `Provisión de la compra ${ref}`,
      book: BOOK_PURCHASES,
      responsible: input.responsible ?? "Sistema ERP",
      purchaseInvoiceId: input.purchaseInvoiceId,
      observation: "Asiento 1/3 — Provisión de la compra (incluye IGV crédito fiscal)",
      status: true,
      entryDetails: {
        create: [
          {
            accountId: accounts.get(ACCOUNT_CODES.purchases)!,
            description: "Compras — valor neto sin impuestos",
            debit: subtotal,
            credit: 0,
          },
          {
            accountId: accounts.get(ACCOUNT_CODES.igvCredit)!,
            description: "IGV crédito fiscal (18%)",
            debit: igv,
            credit: 0,
          },
          {
            accountId: accounts.get(ACCOUNT_CODES.payables)!,
            description: "Cuentas por pagar comerciales — precio total al proveedor",
            debit: 0,
            credit: total,
          },
        ],
      },
    },
    select: { id: true },
  });
  ids.push(provisionPurchaseEntry.id);

  // -----------------------------------------------------------------------
  // 2) Destino / Ingreso al almacén
  //    DEBE: 20 Mercaderías (inventario)
  //    HABER: 61 Variación de inventarios (cuenta correctora del Elemento 6)
  // -----------------------------------------------------------------------
  ids.push(
    await createBalancedEntry(tx, {
      date,
      description: `Ingreso al almacén ${ref}`,
      book: BOOK_PURCHASES,
      responsible: input.responsible,
      purchaseInvoiceId: input.purchaseInvoiceId,
      observation: "Asiento 2/3 — Destino: ingreso físico de bienes al inventario",
      debitAccountId: accounts.get(ACCOUNT_CODES.merchandise)!,
      creditAccountId: accounts.get(ACCOUNT_CODES.inventoryVariation)!,
      amount: subtotal,
      debitLineDescription: "Ingreso de mercaderías / insumos al inventario",
      creditLineDescription: "Variación de inventarios (cuenta correctora)",
    }),
  );

  // -----------------------------------------------------------------------
  // 3) Pago al contado (cancela la obligación con el proveedor)
  //    DEBE: 42 Cuentas por pagar
  //    HABER: 10 Caja/Bancos
  // -----------------------------------------------------------------------
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
        observation: "Asiento 3/3 — Cancelación de cuenta por pagar (contado)",
        debitAccountId: accounts.get(ACCOUNT_CODES.payables)!,
        creditAccountId: cashAccountId,
        amount: total,
        debitLineDescription: "Cancelación de cuentas por pagar al proveedor",
        creditLineDescription: "Salida de efectivo / bancos",
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
