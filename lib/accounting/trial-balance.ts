/**
 * Balance de Comprobación — PCGE / presentación SUNAT.
 *
 * Reporte que presenta, para todas las cuentas del plan contable con actividad:
 * - Saldos iniciales (Debe / Haber) acumulados hasta el día anterior al periodo.
 * - Movimiento del periodo (Debe / Haber) dentro del rango consultado.
 * - Saldos finales (Debe / Haber) = saldo inicial + movimiento del periodo.
 *
 * Las cuentas se agrupan por elemento (primer dígito del código: 1..9) y
 * sub-elemento (los dos primeros dígitos: 10, 12, 40...). Los códigos que no
 * empiezan con un dígito del 1 al 9 se listan bajo "(Sin grupo)".
 *
 * Los importes provienen de los asientos vigentes (`status = true`); solo se
 * muestran cuentas con saldo o movimiento significativo en el periodo.
 */

export interface TrialBalanceAccountInput {
  code: string;
  name: string;
  type: string;
  /** Sum of debits on entries dated before the period start (active entries). */
  initialDebit: number;
  /** Sum of credits on entries dated before the period start (active entries). */
  initialCredit: number;
  /** Sum of debits inside the period [from, to] (active entries). */
  periodDebit: number;
  /** Sum of credits inside the period [from, to] (active entries). */
  periodCredit: number;
}

export interface TrialBalanceAmounts {
  initialDebit: number;
  initialCredit: number;
  periodDebit: number;
  periodCredit: number;
  finalDebit: number;
  finalCredit: number;
}

export interface TrialBalanceLine {
  key: string;
  /** Element or sub-element code (null for "(Sin grupo)"). */
  code: string | null;
  label: string;
  kind: "group" | "subgroup" | "account";
  indent: number;
  /** Aggregated amounts; never null for the current kinds. */
  amounts: TrialBalanceAmounts;
}

export interface TrialBalanceStatement {
  from: string;
  to: string;
  /** Human-readable period, e.g. "oct 2026" or "del 01/09/2026 al 31/10/2026". */
  periodLabel: string;
  currency: "PEN";
  companyName: string;
  reportTitle: string;
  normativeNote: string;
  lines: TrialBalanceLine[];
  totals: TrialBalanceAmounts;
  /** Number of accounts with balance or movement shown in the report. */
  accountCount: number;
  balanced: boolean;
  difference: number;
}

/** Rounds to 2 decimal places (shared with the other accounting modules). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isMeaningful(amount: number): boolean {
  return Math.abs(amount) >= 0.005;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Spanish month short names used by `es-PE` (SUNAT: septiembre = "set"). */
const MONTH_SHORT: Record<number, string> = {
  1: "ene",
  2: "feb",
  3: "mar",
  4: "abr",
  5: "may",
  6: "jun",
  7: "jul",
  8: "ago",
  9: "set",
  10: "oct",
  11: "nov",
  12: "dic",
};

/** Human-readable label of the consulted period ("oct 2026" / "del X al Y"). */
export function formatPeriodLabel(from: string, to: string): string {
  if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) return `del ${from} al ${to}`;
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if (fromYear === toYear && fromMonth === toMonth) {
    return `${MONTH_SHORT[toMonth] ?? toMonth} ${toYear}`;
  }
  const fromShort = `${from.slice(8, 10)}/${from.slice(5, 7)}/${fromYear}`;
  const toShort = `${to.slice(8, 10)}/${to.slice(5, 7)}/${toYear}`;
  return `del ${fromShort} al ${toShort}`;
}

export function emptyAmounts(): TrialBalanceAmounts {
  return {
    initialDebit: 0,
    initialCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    finalDebit: 0,
    finalCredit: 0,
  };
}

/** Aggregates one account into `target` (mutates and returns it). */
function addAmounts(target: TrialBalanceAmounts, account: TrialBalanceAccountInput): TrialBalanceAmounts {
  target.initialDebit = round2(target.initialDebit + (Number(account.initialDebit) || 0));
  target.initialCredit = round2(target.initialCredit + (Number(account.initialCredit) || 0));
  target.periodDebit = round2(target.periodDebit + (Number(account.periodDebit) || 0));
  target.periodCredit = round2(target.periodCredit + (Number(account.periodCredit) || 0));
  target.finalDebit = round2(target.finalDebit + (Number(account.initialDebit) || 0) + (Number(account.periodDebit) || 0));
  target.finalCredit = round2(target.finalCredit + (Number(account.initialCredit) || 0) + (Number(account.periodCredit) || 0));
  return target;
}

/** Element (first digit 1..9) of the account code, or null for other codes. */
function elementKeyOf(code: string): string | null {
  const first = code.trim().charAt(0);
  return first >= "1" && first <= "9" ? first : null;
}

/** Sub-element (first two digits), null when the code is a single-digit header. */
function subKeyOf(code: string): string | null {
  if (elementKeyOf(code) === null) return null;
  return code.length >= 2 ? code.slice(0, 2) : null;
}

/** An account row participates only when it has balance or movement. */
function hasActivity(account: TrialBalanceAccountInput): boolean {
  return (
    isMeaningful(account.initialDebit) ||
    isMeaningful(account.initialCredit) ||
    isMeaningful(account.periodDebit) ||
    isMeaningful(account.periodCredit)
  );
}

function sortAccounts(accounts: TrialBalanceAccountInput[]): TrialBalanceAccountInput[] {
  return [...accounts].sort((a, b) => a.code.localeCompare(b.code, "es"));
}

/** Most frequent account type in the group (used to label element rows). */
function predominantType(accounts: TrialBalanceAccountInput[]): string | null {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    counts.set(account.type, (counts.get(account.type) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

interface SubgroupNode {
  code: string;
  amounts: TrialBalanceAmounts;
  /** Children with codes longer than the sub-element (101, 421...). */
  children: TrialBalanceAccountInput[];
}

interface GroupNode {
  code: string;
  amounts: TrialBalanceAmounts;
  /** Accounts matching the element header or the sub-element (1, 10...). */
  headers: TrialBalanceAccountInput[];
  subgroups: Map<string, SubgroupNode>;
}

export function buildTrialBalance(input: {
  from: string;
  to: string;
  accounts: TrialBalanceAccountInput[];
  companyName?: string;
}): TrialBalanceStatement {
  const active = input.accounts.filter(hasActivity);
  const nameByCode = new Map(input.accounts.map((account) => [account.code, account]));

  const groups = new Map<string, GroupNode>();
  const ungrouped: TrialBalanceAccountInput[] = [];
  const totals = emptyAmounts();

  const groupFor = (key: string, isSinGrupo: boolean): GroupNode => {
    let node = groups.get(key);
    if (!node) {
      node = {
        code: isSinGrupo ? null as unknown as string : key,
        amounts: emptyAmounts(),
        headers: [],
        subgroups: new Map(),
        isSinGrupo,
      };
      groups.set(key, node);
    }
    return node;
  };

  for (const account of active) {
    addAmounts(totals, account);

    const element = elementKeyOf(account.code);
    if (element === null) {
      ungrouped.push(account);
      continue;
    }

    const group = groupFor(element, false);
    addAmounts(group.amounts, account);

    const sub = subKeyOf(account.code);
    if (sub === null) {
      // Single-digit element header: its amounts belong to the element row.
      group.headers.push(account);
      continue;
    }

    let subgroup = group.subgroups.get(sub);
    if (!subgroup) {
      subgroup = { code: sub, amounts: emptyAmounts(), children: [] };
      group.subgroups.set(sub, subgroup);
    }
    addAmounts(subgroup.amounts, account);

    if (account.code.length === 2) subgroup.headers.push(account);
    else subgroup.children.push(account);
  }

  const lines: TrialBalanceLine[] = [];
  const sortedGroups = [...groups.values()].sort((a, b) => a.code.localeCompare(b.code, "es"));

  for (const group of sortedGroups) {
    const groupAccounts = [
      ...group.headers,
      ...[...group.subgroups.values()].flatMap((sub) => [...sub.headers, ...sub.children]),
    ];
    const header = nameByCode.get(group.code);
    const type = predominantType(groupAccounts);
    // The header name is used when its type agrees with the group's accounts;
    // otherwise the predominant type wins (some catalogs mislabel elements).
    const label =
      header && type !== null && header.type === type
        ? header.name
        : (type ?? header?.name ?? `Clase ${group.code}`);

    lines.push({
      key: `group-${group.code}`,
      code: group.code,
      label,
      kind: "group",
      indent: 0,
      amounts: group.amounts,
    });

    const sortedSubs = [...group.subgroups.values()].sort((a, b) => a.code.localeCompare(b.code, "es"));
    for (const subgroup of sortedSubs) {
      lines.push({
        key: `subgroup-${subgroup.code}`,
        code: subgroup.code,
        label: nameByCode.get(subgroup.code)?.name ?? `Grupo ${subgroup.code}`,
        kind: "subgroup",
        indent: 1,
        amounts: subgroup.amounts,
      });
      for (const child of sortAccounts(subgroup.children)) {
        lines.push({
          key: `account-${child.code}`,
          code: child.code,
          label: child.name,
          kind: "account",
          indent: 2,
          amounts: {
            initialDebit: round2(child.initialDebit),
            initialCredit: round2(child.initialCredit),
            periodDebit: round2(child.periodDebit),
            periodCredit: round2(child.periodCredit),
            finalDebit: round2(child.initialDebit + child.periodDebit),
            finalCredit: round2(child.initialCredit + child.periodCredit),
          },
        });
      }
    }
  }

  if (ungrouped.length > 0) {
    const amounts = ungrouped.reduce((acc, account) => addAmounts(acc, account), emptyAmounts());
    lines.push({
      key: "group-sin-grupo",
      code: null,
      label: "(Sin grupo)",
      kind: "group",
      indent: 0,
      amounts,
    });
    for (const account of sortAccounts(ungrouped)) {
      lines.push({
        key: `account-${account.code}`,
        code: account.code,
        label: account.name,
        kind: "account",
        indent: 1,
        amounts: {
          initialDebit: round2(account.initialDebit),
          initialCredit: round2(account.initialCredit),
          periodDebit: round2(account.periodDebit),
          periodCredit: round2(account.periodCredit),
          finalDebit: round2(account.initialDebit + account.periodDebit),
          finalCredit: round2(account.initialCredit + account.periodCredit),
        },
      });
    }
  }

  const difference = round2(totals.finalDebit - totals.finalCredit);

  return {
    from: input.from,
    to: input.to,
    periodLabel: formatPeriodLabel(input.from, input.to),
    currency: "PEN",
    companyName: input.companyName ?? "Pollería ERP",
    reportTitle: "Balance de Comprobación",
    normativeNote:
      "Balance de Comprobación conforme al PCGE: agrupa las cuentas por elemento y sub-elemento del plan contable. El saldo final resulta de sumar el saldo inicial y el movimiento del periodo; incluye solo asientos vigentes y cuentas con saldo o movimiento.",
    lines,
    totals,
    accountCount: active.length,
    balanced: !isMeaningful(difference),
    difference,
  };
}
