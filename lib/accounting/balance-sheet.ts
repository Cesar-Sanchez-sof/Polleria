/**
 * Estado de Situación Financiera (Balance General) — PCGE 2019 / SUNAT.
 *
 * Norma de referencia:
 * - PCGE (Resolución CNC N.º 002-2019-EF/30 / similares) para clasificación de cuentas.
 * - Presentación alineada a NIIF para las PYMES / EEFF que exige SUNAT en libros electrónicos:
 *   Activo (corriente / no corriente), Pasivo (corriente / no corriente) y Patrimonio.
 * - Ecuación patrimonial: Activo = Pasivo + Patrimonio (incluye Resultado del ejercicio).
 *
 * Saldos a una fecha de corte (`asOf`), solo asientos vigentes (`status = true`).
 * El Resultado del ejercicio se calcula con las cuentas de naturaleza Ingreso, Gasto y Costo
 * del mismo ejercicio (01-ene del año de la fecha de corte → `asOf`), porque aún no se
 * ha cerrado contra Resultados acumulados.
 */

export type AccountType =
  | "Activo"
  | "Pasivo"
  | "Patrimonio"
  | "Ingreso"
  | "Gasto"
  | "Costo";

export interface AccountBalanceInput {
  code: string;
  name: string;
  type: AccountType | string;
  /** Sum of debits up to as-of date (active entries only). */
  debit: number;
  /** Sum of credits up to as-of date (active entries only). */
  credit: number;
}

export interface BalanceSheetLine {
  key: string;
  code: string | null;
  label: string;
  /** Signed amount in PEN. Assets: debit nature (+). Liabilities/equity: credit nature (+). */
  amount: number | null;
  kind: "section" | "subsection" | "account" | "subtotal" | "total" | "note";
  indent: number;
}

export interface BalanceSheetStatement {
  asOf: string;
  currency: "PEN";
  companyName: string;
  reportTitle: string;
  normativeNote: string;
  lines: BalanceSheetLine[];
  totals: {
    currentAssets: number;
    nonCurrentAssets: number;
    totalAssets: number;
    currentLiabilities: number;
    nonCurrentLiabilities: number;
    totalLiabilities: number;
    equityBeforeResult: number;
    periodResult: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
  };
  balanced: boolean;
  difference: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isMeaningful(amount: number): boolean {
  return Math.abs(amount) >= 0.005;
}

/** Natural signed balance for balance-sheet presentation. */
export function signedBalance(type: string, debit: number, credit: number): number {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  if (type === "Activo" || type === "Gasto" || type === "Costo") {
    return round2(d - c);
  }
  // Pasivo, Patrimonio, Ingreso → naturaleza acreedora
  return round2(c - d);
}

type GroupDef = {
  id: string;
  label: string;
  match: (code: string) => boolean;
};

const CURRENT_ASSET_GROUPS: GroupDef[] = [
  {
    id: "cash",
    label: "Efectivo y equivalentes de efectivo",
    match: (code) => code.startsWith("10"),
  },
  {
    id: "receivables",
    label: "Cuentas por cobrar comerciales",
    match: (code) => code.startsWith("12"),
  },
  {
    id: "taxCredit",
    label: "Tributos por acreditar",
    match: (code) => code.startsWith("16"),
  },
  {
    id: "inventory",
    label: "Inventarios",
    match: (code) =>
      code.startsWith("20") || code.startsWith("24") || code.startsWith("25"),
  },
];

const NON_CURRENT_ASSET_GROUPS: GroupDef[] = [
  {
    id: "ppe",
    label: "Propiedad, planta y equipo",
    match: (code) => code.startsWith("33") || code.startsWith("39"),
  },
];

const CURRENT_LIABILITY_GROUPS: GroupDef[] = [
  {
    id: "taxesPayable",
    label: "Tributos por pagar",
    match: (code) => code.startsWith("40"),
  },
  {
    id: "payrollPayable",
    label: "Remuneraciones por pagar",
    match: (code) => code.startsWith("41"),
  },
  {
    id: "tradePayables",
    label: "Cuentas por pagar comerciales",
    match: (code) => code.startsWith("42"),
  },
  {
    id: "otherPayables",
    label: "Otras cuentas por pagar",
    match: (code) => code.startsWith("46"),
  },
];

const NON_CURRENT_LIABILITY_GROUPS: GroupDef[] = [];

const EQUITY_GROUPS: GroupDef[] = [
  {
    id: "capital",
    label: "Capital",
    match: (code) => code.startsWith("50"),
  },
  {
    id: "retained",
    label: "Resultados acumulados",
    match: (code) => code.startsWith("59"),
  },
];

function isDetailAccount(code: string): boolean {
  // Skip pure element headers like "1", "2", "3"
  return code.length >= 2;
}

function appendGroup(
  lines: BalanceSheetLine[],
  accounts: AccountBalanceInput[],
  groups: GroupDef[],
  sectionPrefix: string,
  scopeMatch?: (code: string) => boolean
): number {
  let sectionTotal = 0;
  const scoped = scopeMatch
    ? accounts.filter((a) => scopeMatch(a.code))
    : accounts;

  for (const group of groups) {
    const rows = scoped
      .filter((a) => isDetailAccount(a.code) && group.match(a.code))
      .map((a) => ({
        ...a,
        amount: signedBalance(a.type, a.debit, a.credit),
      }))
      .filter((a) => isMeaningful(a.amount))
      .sort((a, b) => a.code.localeCompare(b.code, "es"));

    if (rows.length === 0) continue;

    const groupTotal = round2(rows.reduce((sum, row) => sum + row.amount, 0));
    sectionTotal = round2(sectionTotal + groupTotal);

    lines.push({
      key: `${sectionPrefix}-${group.id}`,
      code: null,
      label: group.label,
      amount: null,
      kind: "subsection",
      indent: 1,
    });

    for (const row of rows) {
      lines.push({
        key: `${sectionPrefix}-${row.code}`,
        code: row.code,
        label: row.name,
        amount: row.amount,
        kind: "account",
        indent: 2,
      });
    }

    lines.push({
      key: `${sectionPrefix}-${group.id}-total`,
      code: null,
      label: `Total ${group.label.toLowerCase()}`,
      amount: groupTotal,
      kind: "subtotal",
      indent: 1,
    });
  }

  // Solo cuentas del alcance de la sección no cubiertas por un grupo conocido
  const matched = new Set(
    groups.flatMap((g) =>
      scoped.filter((a) => isDetailAccount(a.code) && g.match(a.code)).map((a) => a.code)
    )
  );
  const orphan = scoped
    .filter((a) => isDetailAccount(a.code) && !matched.has(a.code))
    .map((a) => ({
      ...a,
      amount: signedBalance(a.type, a.debit, a.credit),
    }))
    .filter((a) => isMeaningful(a.amount))
    .sort((a, b) => a.code.localeCompare(b.code, "es"));

  if (orphan.length > 0) {
    lines.push({
      key: `${sectionPrefix}-other`,
      code: null,
      label: "Otros",
      amount: null,
      kind: "subsection",
      indent: 1,
    });
    for (const row of orphan) {
      sectionTotal = round2(sectionTotal + row.amount);
      lines.push({
        key: `${sectionPrefix}-${row.code}`,
        code: row.code,
        label: row.name,
        amount: row.amount,
        kind: "account",
        indent: 2,
      });
    }
  }

  return sectionTotal;
}

export function computePeriodResult(accounts: AccountBalanceInput[]): number {
  let result = 0;
  for (const account of accounts) {
    if (!isDetailAccount(account.code)) continue;
    if (account.type === "Ingreso") {
      result = round2(result + signedBalance(account.type, account.debit, account.credit));
    } else if (account.type === "Gasto" || account.type === "Costo") {
      result = round2(result - signedBalance(account.type, account.debit, account.credit));
    }
  }
  return result;
}

export function buildBalanceSheet(input: {
  asOf: string;
  accounts: AccountBalanceInput[];
  companyName?: string;
}): BalanceSheetStatement {
  const assets = input.accounts.filter((a) => a.type === "Activo");
  const liabilities = input.accounts.filter((a) => a.type === "Pasivo");
  const equityAccounts = input.accounts.filter((a) => a.type === "Patrimonio");
  const pnlAccounts = input.accounts.filter(
    (a) => a.type === "Ingreso" || a.type === "Gasto" || a.type === "Costo"
  );

  const lines: BalanceSheetLine[] = [];

  lines.push({
    key: "assets",
    code: null,
    label: "ACTIVO",
    amount: null,
    kind: "section",
    indent: 0,
  });

  lines.push({
    key: "current-assets",
    code: null,
    label: "Activo corriente",
    amount: null,
    kind: "subsection",
    indent: 0,
  });
  const currentAssets = appendGroup(
    lines,
    assets,
    CURRENT_ASSET_GROUPS,
    "ca",
    (code) =>
      code.startsWith("10") ||
      code.startsWith("12") ||
      code.startsWith("16") ||
      code.startsWith("20") ||
      code.startsWith("24") ||
      code.startsWith("25")
  );
  lines.push({
    key: "current-assets-total",
    code: null,
    label: "Total activo corriente",
    amount: currentAssets,
    kind: "subtotal",
    indent: 0,
  });

  lines.push({
    key: "non-current-assets",
    code: null,
    label: "Activo no corriente",
    amount: null,
    kind: "subsection",
    indent: 0,
  });
  const nonCurrentAssets = appendGroup(
    lines,
    assets,
    NON_CURRENT_ASSET_GROUPS,
    "nca",
    (code) => code.startsWith("33") || code.startsWith("39")
  );
  lines.push({
    key: "non-current-assets-total",
    code: null,
    label: "Total activo no corriente",
    amount: nonCurrentAssets,
    kind: "subtotal",
    indent: 0,
  });

  const totalAssets = round2(currentAssets + nonCurrentAssets);
  lines.push({
    key: "total-assets",
    code: null,
    label: "TOTAL ACTIVO",
    amount: totalAssets,
    kind: "total",
    indent: 0,
  });

  lines.push({
    key: "liabilities",
    code: null,
    label: "PASIVO",
    amount: null,
    kind: "section",
    indent: 0,
  });

  lines.push({
    key: "current-liabilities",
    code: null,
    label: "Pasivo corriente",
    amount: null,
    kind: "subsection",
    indent: 0,
  });
  const currentLiabilities = appendGroup(
    lines,
    liabilities,
    CURRENT_LIABILITY_GROUPS,
    "cl",
    (code) =>
      code.startsWith("40") ||
      code.startsWith("41") ||
      code.startsWith("42") ||
      code.startsWith("46")
  );
  lines.push({
    key: "current-liabilities-total",
    code: null,
    label: "Total pasivo corriente",
    amount: currentLiabilities,
    kind: "subtotal",
    indent: 0,
  });

  lines.push({
    key: "non-current-liabilities",
    code: null,
    label: "Pasivo no corriente",
    amount: null,
    kind: "subsection",
    indent: 0,
  });
  const nonCurrentLiabilities = appendGroup(
    lines,
    liabilities,
    NON_CURRENT_LIABILITY_GROUPS,
    "ncl",
    (code) => code.startsWith("45") || code.startsWith("47") || code.startsWith("49")
  );
  lines.push({
    key: "non-current-liabilities-total",
    code: null,
    label: "Total pasivo no corriente",
    amount: nonCurrentLiabilities,
    kind: "subtotal",
    indent: 0,
  });

  const totalLiabilities = round2(currentLiabilities + nonCurrentLiabilities);
  lines.push({
    key: "total-liabilities",
    code: null,
    label: "TOTAL PASIVO",
    amount: totalLiabilities,
    kind: "total",
    indent: 0,
  });

  lines.push({
    key: "equity",
    code: null,
    label: "PATRIMONIO",
    amount: null,
    kind: "section",
    indent: 0,
  });

  const equityBeforeResult = appendGroup(
    lines,
    equityAccounts,
    EQUITY_GROUPS,
    "eq",
    (code) => code.startsWith("50") || code.startsWith("59")
  );
  const periodResult = computePeriodResult(pnlAccounts);

  lines.push({
    key: "period-result",
    code: null,
    label: "Resultado del ejercicio",
    amount: periodResult,
    kind: "account",
    indent: 1,
  });
  lines.push({
    key: "period-result-note",
    code: null,
    label:
      "Utilidad (pérdida) del ejercicio según cuentas de ingreso, gasto y costo (PCGE), pendiente de cierre a Resultados acumulados.",
    amount: null,
    kind: "note",
    indent: 2,
  });

  const totalEquity = round2(equityBeforeResult + periodResult);
  lines.push({
    key: "total-equity",
    code: null,
    label: "TOTAL PATRIMONIO",
    amount: totalEquity,
    kind: "total",
    indent: 0,
  });

  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  lines.push({
    key: "total-liabilities-equity",
    code: null,
    label: "TOTAL PASIVO Y PATRIMONIO",
    amount: totalLiabilitiesAndEquity,
    kind: "total",
    indent: 0,
  });

  const difference = round2(totalAssets - totalLiabilitiesAndEquity);

  return {
    asOf: input.asOf,
    currency: "PEN",
    companyName: input.companyName ?? "Pollería ERP",
    reportTitle: "Estado de Situación Financiera",
    normativeNote:
      "Elaborado conforme al PCGE y a la presentación del Estado de Situación Financiera (activo, pasivo y patrimonio). Saldos en soles (PEN) a la fecha de corte, con asientos vigentes. El Resultado del ejercicio se incorpora al patrimonio para cumplir la ecuación contable Activo = Pasivo + Patrimonio.",
    lines,
    totals: {
      currentAssets,
      nonCurrentAssets,
      totalAssets,
      currentLiabilities,
      nonCurrentLiabilities,
      totalLiabilities,
      equityBeforeResult,
      periodResult,
      totalEquity,
      totalLiabilitiesAndEquity,
    },
    balanced: !isMeaningful(difference),
    difference,
  };
}
