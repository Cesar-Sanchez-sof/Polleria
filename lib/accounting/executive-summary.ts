/**
 * Resumen Ejecutivo — panel de métricas clave del ejercicio.
 *
 * Sintetiza en un solo reporte, para un periodo (año), cinco bloques:
 * - Efectivo: entradas, salidas, superávit del periodo y saldo bancario de cierre.
 * - Rentabilidad: ingreso, costo de ingresos, ganancia bruta, gastos y ganancia neta.
 * - Balance general: cuentas por cobrar, por pagar y activos netos.
 * - Rendimiento: márgenes de ganancia bruta y neta, y retorno de la inversión.
 * - Posición: periodos medios de cobro/pago, pronóstico de efectivo y razón de
 *   capital circulante frente a pasivos corrientes.
 *
 * Cálculo puro y determinista (sin acceso a base de datos): el orquestador que
 * consulta `journal_entry_detail` vive en `lib/services/executive-summary.service.ts`.
 *
 * Los importes provienen de asientos vigentes (`status = true`). Las cuentas se
 * clasifican por su `type` (Activo, Pasivo, Ingreso, Gasto, Costo) y por el
 * prefijo de código del PCGE (10 efectivo, 12 por cobrar, 42 por pagar, etc.).
 */

/** Naturaleza contable del cuenta, alineada al plan del proyecto. */
export type AccountType = "Activo" | "Pasivo" | "Patrimonio" | "Ingreso" | "Gasto" | "Costo";

export interface ExecutiveAccountInput {
  code: string;
  name: string;
  type: AccountType | string;
  /** Debits posted to the account inside the period [from, to]. */
  periodDebit: number;
  /** Credits posted to the account inside the period [from, to]. */
  periodCredit: number;
  /** Cumulative debits up to the period end (`to`). */
  balanceDebit: number;
  /** Cumulative credits up to the period end (`to`). */
  balanceCredit: number;
}

/** Formato de presentación de una métrica. */
export type ExecutiveMetricFormat = "currency" | "percent" | "number";

export interface ExecutiveMetric {
  key: string;
  label: string;
  /** Valor numérico ya calculado; el formateo ocurre en la capa de presentación. */
  value: number;
  format: ExecutiveMetricFormat;
  /** Texto auxiliar aclaratorio junto a la métrica. */
  hint?: string;
}

export interface ExecutiveSection {
  key: "efectivo" | "rentabilidad" | "balance" | "rendimiento" | "posicion";
  label: string;
  metrics: ExecutiveMetric[];
}

export interface ExecutiveSummary {
  year: number;
  from: string;
  to: string;
  currency: "PEN";
  companyName: string;
  reportTitle: string;
  normativeNote: string;
  sections: ExecutiveSection[];
  totals: {
    cashReceived: number;
    cashSpent: number;
    cashSurplus: number;
    cashClosingBalance: number;
    income: number;
    costOfIncome: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    receivables: number;
    payables: number;
    netAssets: number;
    totalAssets: number;
    totalLiabilities: number;
  };
}

/** Rounds to 2 decimal places (shared with the other accounting modules). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isMeaningful(amount: number): boolean {
  return Math.abs(amount) >= 0.005;
}

/** Net movement (income-statement nature) for P&L accounts. */
function netMovement(account: ExecutiveAccountInput): number {
  const debit = Number(account.periodDebit) || 0;
  const credit = Number(account.periodCredit) || 0;
  if (account.type === "Ingreso") return round2(credit - debit);
  // Gasto y Costo tienen naturaleza deudora.
  return round2(debit - credit);
}

/** Cumulative net balance for balance-sheet accounts, in natural sign. */
function netBalance(account: ExecutiveAccountInput): number {
  const debit = Number(account.balanceDebit) || 0;
  const credit = Number(account.balanceCredit) || 0;
  if (account.type === "Activo" || account.type === "Gasto" || account.type === "Costo") {
    return round2(debit - credit);
  }
  // Pasivo y Patrimonio: naturaleza acreedora.
  return round2(credit - debit);
}

function sum(items: number[]): number {
  return round2(items.reduce((total, value) => total + value, 0));
}

/** División segura: evita NaN/Infinity cuando el denominador es cero. */
function safeRatio(numerator: number, denominator: number): number {
  if (!isMeaningful(denominator)) return 0;
  return numerator / denominator;
}

function startsWithCode(account: ExecutiveAccountInput, prefixes: string[]): boolean {
  return prefixes.some((prefix) => account.code.startsWith(prefix));
}

/** Cuentas de efectivo y equivalentes (elemento 10). */
function isCash(account: ExecutiveAccountInput): boolean {
  return account.type === "Activo" && startsWithCode(account, ["10"]);
}

/** Cuentas por cobrar comerciales y otras del activo corriente (elemento 12). */
function isReceivable(account: ExecutiveAccountInput): boolean {
  return account.type === "Activo" && startsWithCode(account, ["12"]);
}

/** Cuentas por pagar comerciales (elemento 42). */
function isPayable(account: ExecutiveAccountInput): boolean {
  return account.type === "Pasivo" && startsWithCode(account, ["42"]);
}

/** Activo corriente (10, 12, 16, 20, 24, 25) — alineado al Balance General. */
function isCurrentAsset(account: ExecutiveAccountInput): boolean {
  return (
    account.type === "Activo" &&
    startsWithCode(account, ["10", "12", "16", "20", "24", "25"])
  );
}

/** Pasivo corriente (40, 41, 42, 46) — alineado al Balance General. */
function isCurrentLiability(account: ExecutiveAccountInput): boolean {
  return account.type === "Pasivo" && startsWithCode(account, ["40", "41", "42", "46"]);
}

export function buildExecutiveSummary(input: {
  year: number;
  from: string;
  to: string;
  accounts: ExecutiveAccountInput[];
  companyName?: string;
}): ExecutiveSummary {
  const { accounts } = input;

  const cashAccounts = accounts.filter(isCash);
  const incomeAccounts = accounts.filter((a) => a.type === "Ingreso");
  const costAccounts = accounts.filter((a) => a.type === "Costo");
  const expenseAccounts = accounts.filter((a) => a.type === "Gasto");
  const assetAccounts = accounts.filter((a) => a.type === "Activo");
  const liabilityAccounts = accounts.filter((a) => a.type === "Pasivo");
  const receivableAccounts = accounts.filter(isReceivable);
  const payableAccounts = accounts.filter(isPayable);
  const currentAssetAccounts = accounts.filter(isCurrentAsset);
  const currentLiabilityAccounts = accounts.filter(isCurrentLiability);

  // ----- Efectivo -----
  const cashReceived = sum(cashAccounts.map((a) => Number(a.periodDebit) || 0));
  const cashSpent = sum(cashAccounts.map((a) => Number(a.periodCredit) || 0));
  const cashSurplus = round2(cashReceived - cashSpent);
  const cashClosingBalance = sum(cashAccounts.map(netBalance));

  // ----- Rentabilidad -----
  const income = sum(incomeAccounts.map(netMovement));
  const costOfIncome = sum(costAccounts.map(netMovement));
  const grossProfit = round2(income - costOfIncome);
  const expenses = sum(expenseAccounts.map(netMovement));
  const netProfit = round2(grossProfit - expenses);

  // ----- Balance general -----
  const receivables = sum(receivableAccounts.map(netBalance));
  const payables = sum(payableAccounts.map(netBalance));
  const totalAssets = sum(assetAccounts.map(netBalance));
  const totalLiabilities = sum(liabilityAccounts.map(netBalance));
  const netAssets = round2(totalAssets - totalLiabilities);

  // ----- Rendimiento -----
  const grossMargin = round2(safeRatio(grossProfit, income) * 100);
  const netMargin = round2(safeRatio(netProfit, income) * 100);
  const roi = round2(safeRatio(netProfit, totalAssets) * 100);

  // ----- Posición -----
  const avgCollectionDays = round2(safeRatio(receivables, income) * 365);
  const avgPaymentDays = round2(safeRatio(payables, costOfIncome + expenses) * 365);
  const shortTermCashForecast = round2(cashSurplus + receivables - payables);
  const currentAssetsNet = sum(currentAssetAccounts.map(netBalance));
  const currentLiabilitiesNet = sum(currentLiabilityAccounts.map(netBalance));
  const currentRatio = round2(safeRatio(currentAssetsNet, currentLiabilitiesNet));

  const sections: ExecutiveSection[] = [
    {
      key: "efectivo",
      label: "Efectivo",
      metrics: [
        { key: "cash-received", label: "Efectivo recibido", value: cashReceived, format: "currency" },
        { key: "cash-spent", label: "Efectivo gastado", value: cashSpent, format: "currency" },
        { key: "cash-surplus", label: "Superávit de efectivo", value: cashSurplus, format: "currency" },
        {
          key: "cash-closing",
          label: "Balance bancario de cierre",
          value: cashClosingBalance,
          format: "currency",
          hint: "Saldo neto acumulado de las cuentas de efectivo y bancos.",
        },
      ],
    },
    {
      key: "rentabilidad",
      label: "Rentabilidad",
      metrics: [
        { key: "income", label: "Ingreso", value: income, format: "currency" },
        { key: "cost-of-income", label: "Costo de ingresos", value: costOfIncome, format: "currency" },
        { key: "gross-profit", label: "Ganancia bruta", value: grossProfit, format: "currency" },
        { key: "expenses", label: "Gastos", value: expenses, format: "currency" },
        { key: "net-profit", label: "Ganancias netas", value: netProfit, format: "currency" },
      ],
    },
    {
      key: "balance",
      label: "Balance general",
      metrics: [
        { key: "receivables", label: "Por cobrar", value: receivables, format: "currency" },
        { key: "payables", label: "Por pagar", value: payables, format: "currency" },
        { key: "net-assets", label: "Activos netos", value: netAssets, format: "currency" },
      ],
    },
    {
      key: "rendimiento",
      label: "Rendimiento",
      metrics: [
        {
          key: "gross-margin",
          label: "Margen de ganancia bruta",
          value: grossMargin,
          format: "percent",
          hint: "ganancia bruta / ingreso",
        },
        {
          key: "net-margin",
          label: "Margen neto de ganancias",
          value: netMargin,
          format: "percent",
          hint: "ganancias netas / ingresos",
        },
        {
          key: "roi",
          label: "Retorno de la inversión",
          value: roi,
          format: "percent",
          hint: "ganancia neta / activos",
        },
      ],
    },
    {
      key: "posicion",
      label: "Posición",
      metrics: [
        {
          key: "avg-collection",
          label: "Periodo promedio de cobro",
          value: avgCollectionDays,
          format: "number",
          hint: "días",
        },
        {
          key: "avg-payment",
          label: "Periodo promedio de pago",
          value: avgPaymentDays,
          format: "number",
          hint: "días",
        },
        {
          key: "cash-forecast",
          label: "Pronóstico de efectivo a corto plazo",
          value: shortTermCashForecast,
          format: "currency",
          hint: "superávit + por cobrar − por pagar",
        },
        {
          key: "current-vs-liabilities",
          label: "Activos circulantes frente a pasivos",
          value: currentRatio,
          format: "number",
          hint: "activo corriente / pasivo corriente",
        },
      ],
    },
  ];

  return {
    year: input.year,
    from: input.from,
    to: input.to,
    currency: "PEN",
    companyName: input.companyName ?? "Pollería ERP",
    reportTitle: "Resumen Ejecutivo",
    normativeNote:
      "Resumen Ejecutivo conforme al PCGE: consolida efectivo, rentabilidad, balance general, rendimiento y posición. Incluye solo asientos vigentes; los importes del periodo corresponden al ejercicio consultado y los saldos de balance se acumulan hasta el cierre del periodo.",
    sections,
    totals: {
      cashReceived,
      cashSpent,
      cashSurplus,
      cashClosingBalance,
      income,
      costOfIncome,
      grossProfit,
      expenses,
      netProfit,
      receivables,
      payables,
      netAssets,
      totalAssets,
      totalLiabilities,
    },
  };
}
