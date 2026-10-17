/**
 * Dashboard Contable (Resumen Financiero) — cálculo puro, sin imports de Prisma.
 *
 * Capa de presentación del resumen financiero: KPIs del período con variación vs el
 * período anterior, serie mensual (12 meses), distribución de gastos por categoría PCGE
 * y cuentas con mayor monto movido.
 *
 * Regla crítica (SC-002/FR-009): los saldos se calculan con `signedBalance` de
 * `lib/accounting/balance-sheet.ts` y los mismos filtros de vigencia que los reportes
 * oficiales (cuentas `active`, asientos `entry.status = true`), de modo que los valores
 * coinciden exactamente con `/api/balance-sheet`.
 *
 * Ver `specs/026-accounting-dashboard/` (data-model.md §3, research.md R2–R4).
 */

import { signedBalance, round2, type AccountType } from "./balance-sheet";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";

/* ------------------------------------------------------------------ *
 * Tipos del contrato (T002) — data-model.md §3 / contracts/*.yaml
 * ------------------------------------------------------------------ */

export type KpiKey =
  | "income"
  | "expenses"
  | "profit"
  | "caja_bancos"
  | "por_cobrar"
  | "por_pagar"
  | "entries";

/** Variación vs el período anterior, redondeada a 1 decimal (research R4). */
export interface Variation {
  percent: number;
  direction: "up" | "down" | "flat";
}

export interface Kpi {
  key: KpiKey;
  label: string;
  /** PEN con 2 decimales (`currency`) o cantidad entera (`count`). */
  value: number;
  kind: "currency" | "count";
  /** `null` cuando no hay período anterior comparable o `|anterior| < 0.005`. */
  variation: Variation | null;
}

/** Punto de la serie mensual (`YYYY-MM`), meses sin datos en 0. */
export interface MonthlyPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
}

/** Gastos de una categoría PCGE agrupados por prefijo de cuenta. */
export interface ExpenseCategory {
  category: string;
  code: string;
  amount: number;
  /** Proporción 0–100 sobre el total de gastos del rango; suma 100 si hay gastos. */
  percent: number;
}

/** Cuenta con mayor `abs(suma(debit) − suma(credit))` en el rango (top 8). */
export interface TopAccount {
  code: string;
  name: string;
  amount: number;
}

export interface DashboardPayload {
  period: { from: string; to: string; label: string };
  previousPeriod: { from: string; to: string } | null;
  kpis: Kpi[];
  monthlySeries: MonthlyPoint[];
  expenseBreakdown: ExpenseCategory[];
  topAccounts: TopAccount[];
  meta: { currency: "PEN"; empty: boolean; generatedAt: string };
}

/** Sumas por cuenta: `code`/`name`/`type` de la cuenta + sumas de debit/credit. */
export interface AccountMovement {
  code: string;
  name: string;
  type: AccountType | string;
  debit: number;
  credit: number;
}

/** Fila cruda de la serie mensual (`YYYY-MM`), salida de la consulta mensual. */
export interface MonthlyRow {
  /** Mes en formato `YYYY-MM`. */
  month: string;
  type: AccountType | string;
  debit: number;
  credit: number;
}

/** Agregados del período anterior (mismo rango de duración) o `null` si no aplica. */
export interface PreviousAggregates {
  from: string;
  to: string;
  periodAccounts: AccountMovement[];
  balanceAccounts: AccountMovement[];
  entryCount: number;
}

/** Entrada pura de `buildDashboard`: todos los agregados ya leídos por la ruta. */
export interface DashboardInput {
  from: string;
  to: string;
  /** ISO timestamp de generación; por defecto `new Date().toISOString()`. */
  generatedAt?: string;
  /** Cuentas P&L (`Ingreso|Gasto|Costo`) con sumas del rango `desde`–`hasta`. */
  periodAccounts: AccountMovement[];
  /** Cuentas de balance con sumas acumuladas `<= hasta`. */
  balanceAccounts: AccountMovement[];
  previous: PreviousAggregates | null;
  /** Serie de los últimos 12 meses terminados en `hasta` (puede venir vacía). */
  monthlyRows: MonthlyRow[];
  /** Movimiento por cuenta en el rango `desde`–`hasta` (todas las cuentas activas). */
  accountMovement: AccountMovement[];
  entryCount: number;
}

/* ------------------------------------------------------------------ *
 * Helpers puros compartidos (T003) — research R4 / data-model.md §3
 * ------------------------------------------------------------------ */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida el rango de consulta. Devuelve el mensaje de error (`400`) o `null` si es
 * válido: "`desde`/`hasta` obligatorios con formato `YYYY-MM-DD`; `desde <= hasta`".
 */
export function validateRange(from?: string | null, to?: string | null): string | null {
  const d = (from ?? "").trim();
  const h = (to ?? "").trim();
  if (!d || !h || !DATE_REGEX.test(d) || !DATE_REGEX.test(h)) {
    return "Las fechas deben tener el formato YYYY-MM-DD.";
  }
  if (d > h) {
    return "Las fechas deben tener el formato YYYY-MM-DD y desde no puede ser posterior a hasta.";
  }
  return null;
}

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Período anterior de igual duración en días (research R4):
 * `desde_prev = desde − duración`, `hasta_prev = desde − 1 día`.
 * Devuelve `null` si `desde`/`hasta` no son válidos.
 */
export function resolvePreviousRange(from: string, to: string): DateRange | null {
  if (validateRange(from, to)) return null;
  const start = parseUtcDate(from);
  const end = parseUtcDate(to);
  const durationMs = end.getTime() - start.getTime();
  const prevEndMs = start.getTime() - 86_400_000; // 1 día antes del inicio
  const prevStartMs = prevEndMs - durationMs;
  return {
    from: formatDateToIso(new Date(prevStartMs)),
    to: formatDateToIso(new Date(prevEndMs)),
  };
}

/**
 * Variación porcentual vs el período anterior, redondeada a 1 decimal.
 * `null` cuando no hay período anterior o `|anterior| < 0.005` (FR-002, R4).
 */
export function computeVariation(
  actual: number,
  previous: number | null | undefined
): Variation | null {
  if (previous === null || previous === undefined) return null;
  const prev = Number(previous);
  if (!Number.isFinite(prev) || Math.abs(prev) < 0.005) return null;
  const current = Number(actual) || 0;
  const percent = Math.round(((current - prev) / Math.abs(prev)) * 1000) / 10;
  const direction: Variation["direction"] =
    percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return { percent, direction };
}

/** Etiqueta del rango visible en es-PE (FR-008): "01 de marzo — 31 de marzo de 2026". */
export function formatRangeLabel(from: string, to: string): string {
  const parts = (iso: string): { day: number; month: string; year: number } | null => {
    if (!DATE_REGEX.test(iso)) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return {
      day: d,
      year: y,
      month: new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", month: "long" })
        .format(date)
        .toLowerCase(),
    };
  };
  const start = parts(from);
  const end = parts(to);
  if (!start || !end) return `${from} — ${to}`;

  const day = (n: number): string => String(n).padStart(2, "0");
  const left =
    start.year === end.year
      ? `${day(start.day)} de ${start.month}`
      : `${day(start.day)} de ${start.month} de ${start.year}`;
  const right = `${day(end.day)} de ${end.month} de ${end.year}`;
  return `${left} — ${right}`;
}

/** Etiqueta corta de mes para la serie: "oct 2026" (es-PE, UTC). */
export function formatMonthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Rango por defecto del dashboard (T018, research R4): si hay un periodo
 * contable abierto (`status = "OPEN"`) se usa su rango; si no, los últimos
 * 12 meses terminados en `todayIso`.
 */
export function resolveDefaultRange(
  openPeriod: { startDate: string; endDate: string } | null | undefined,
  todayIso: string
): { from: string; to: string } {
  if (
    openPeriod &&
    DATE_REGEX.test(openPeriod.startDate) &&
    DATE_REGEX.test(openPeriod.endDate) &&
    openPeriod.startDate <= openPeriod.endDate
  ) {
    return { from: openPeriod.startDate, to: openPeriod.endDate };
  }
  if (!DATE_REGEX.test(todayIso)) {
    throw new Error("resolveDefaultRange: todayIso debe ser YYYY-MM-DD.");
  }
  // Últimos 12 meses: mismo día del mes 12 atrás (clamp al último día si no existe).
  const [y, m, d] = todayIso.split("-").map(Number);
  const targetMonth = new Date(Date.UTC(y, m - 13, 1)); // m es 1-based
  const lastDayOfMonth = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const start = new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(d, lastDayOfMonth)
    )
  );
  return { from: formatDateToIso(start), to: todayIso };
}

/* ------------------------------------------------------------------ *
 * US2 (T013) — serie mensual, distribución de gastos y top cuentas
 * ------------------------------------------------------------------ */

/** Categorías PCGE de gasto por prefijo de cuenta (data-model.md §3). */
const EXPENSE_CATEGORIES: Array<{ prefix: string; category: string }> = [
  { prefix: "60", category: "Costo de ventas" },
  { prefix: "62", category: "Gastos de personal" },
  { prefix: "63", category: "Servicios" },
  { prefix: "64", category: "Arrendamientos" },
  { prefix: "65", category: "Otros gastos de gestión" },
  { prefix: "67", category: "Gastos financieros" },
  { prefix: "68", category: "Impuestos y contribuciones" },
  { prefix: "69", category: "Costos no deducibles" },
];

/** Clave `YYYY-MM` de un UTC timestamp. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Serie mensual de ingresos/gastos/utilidad (T013, FR-003/FR-004).
 *
 * Cubre los últimos hasta 12 meses terminados en `hasta` (o todos los meses
 * del rango si el rango es menor); meses sin datos → 0. `utilidad` puede ser
 * negativa (pérdida).
 */
export function buildMonthlySeries(
  from: string,
  to: string,
  rows: MonthlyRow[]
): MonthlyPoint[] {
  if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to) || from > to) return [];

  const end = parseUtcDate(to);
  const start = parseUtcDate(from);
  // Límite inferior: inicio del rango o el mes de `hasta` − 11 meses.
  const [hy, hm] = to.split("-").map(Number);
  const twelveMonthsStart = new Date(Date.UTC(hy, hm - 12, 1));
  const firstMonth = start > twelveMonthsStart ? start : twelveMonthsStart;

  const byMonth = new Map<string, { income: number; expenses: number }>();
  for (const row of rows) {
    const acc = byMonth.get(row.month) ?? { income: 0, expenses: 0 };
    if (row.type === "Ingreso") {
      acc.income += signedBalance(row.type, row.debit, row.credit);
    } else if (row.type === "Gasto" || row.type === "Costo") {
      acc.expenses += signedBalance(row.type, row.debit, row.credit);
    }
    byMonth.set(row.month, acc);
  }

  const series: MonthlyPoint[] = [];
  for (
    let cursor = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth(), 1));
    cursor <= end;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const month = monthKey(cursor);
    const acc = byMonth.get(month) ?? { income: 0, expenses: 0 };
    series.push({
      month,
      label: formatMonthLabel(month),
      income: round2(acc.income),
      expenses: round2(acc.expenses),
      profit: round2(acc.income - acc.expenses),
    });
  }
  return series;
}

/**
 * Distribución de gastos por categoría PCGE del rango (T013, FR-005).
 * Agrupa las cuentas `Gasto|Costo` por prefijo; los `percent` suman 100
 * (el último category recibe el residuo de redondeo).
 */
export function buildExpenseBreakdown(periodAccounts: AccountMovement[]): ExpenseCategory[] {
  const expenseAccounts = periodAccounts.filter(
    (a) => a.type === "Gasto" || a.type === "Costo"
  );
  const byCategory = new Map<string, number>();
  for (const account of expenseAccounts) {
    const match = EXPENSE_CATEGORIES.find((c) => account.code.startsWith(c.prefix));
    const key = match?.category ?? "Otros";
    byCategory.set(key, (byCategory.get(key) ?? 0) + signedBalance(account.type, account.debit, account.credit));
  }

  const entries = EXPENSE_CATEGORIES.map((c) => ({
    category: c.category,
    code: c.prefix,
    amount: round2(byCategory.get(c.category) ?? 0),
  })).filter((e) => Math.abs(e.amount) >= 0.005);

  // Cuentas de gasto fuera de los prefijos conocidos (letras, otros).
  const knownAmount = entries.reduce((acc, e) => acc + e.amount, 0);
  const totalRaw = expenseAccounts.reduce(
    (acc, a) => acc + signedBalance(a.type, a.debit, a.credit),
    0
  );
  const others = round2(totalRaw - knownAmount);
  if (Math.abs(others) >= 0.005) {
    entries.push({ category: "Otros", code: "—", amount: others });
  }

  const total = round2(entries.reduce((acc, e) => acc + e.amount, 0));
  if (Math.abs(total) < 0.005) return [];

  let assigned = 0;
  return entries.map((entry, index) => {
    const percent =
      index === entries.length - 1
        ? round2(100 - assigned)
        : round2((entry.amount / total) * 100);
    assigned = round2(assigned + percent);
    return { ...entry, percent };
  });
}

/**
 * Cuentas con mayor monto movido en el rango (T013, FR-006, research R2.1):
 * `abs(suma(debit) − suma(credit))`, top 8, descartando montos < 0.005.
 */
export function buildTopAccounts(
  accountMovement: AccountMovement[],
  top = 8
): TopAccount[] {
  return accountMovement
    .map((a) => ({
      code: a.code,
      name: a.name,
      amount: round2(Math.abs(a.debit - a.credit)),
    }))
    .filter((a) => a.amount >= 0.005)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, top);
}

/** Suma `signedBalance` sobre las cuentas cuyo código empieza con `prefix`. */
function sumByPrefix(accounts: AccountMovement[], prefix: string): number {
  return round2(
    accounts
      .filter((a) => a.code.startsWith(prefix))
      .reduce((acc, a) => acc + signedBalance(a.type, a.debit, a.credit), 0)
  );
}

/** Suma `signedBalance` de las cuentas de un tipo dado. */
function sumByType(accounts: AccountMovement[], types: string[]): number {
  return round2(
    accounts
      .filter((a) => types.includes(a.type))
      .reduce((acc, a) => acc + signedBalance(a.type, a.debit, a.credit), 0)
  );
}

const KPI_LABELS: Record<KpiKey, string> = {
  income: "Ingresos",
  expenses: "Gastos",
  profit: "Utilidad neta",
  caja_bancos: "Caja y bancos",
  por_cobrar: "Cuentas por cobrar",
  por_pagar: "Cuentas por pagar",
  entries: "Asientos registrados",
};

/** Valores brutos de los 7 KPI para un período dado. */
interface KpiValues {
  income: number;
  expenses: number;
  profit: number;
  caja_bancos: number;
  por_cobrar: number;
  por_pagar: number;
  entries: number;
}

/**
 * Calcula los 7 KPI (T005).
 *
 * - P&L (`ingresos`, `gastos`, `utilidad`) sobre el **rango** (`desde`–`hasta`).
 * - Saldos de balance (`caja_bancos` 10*, `por_cobrar` 12*, `por_pagar` 42*)
 *   **acumulados** hasta `hasta` (misma semántica que `/api/balance-sheet`).
 * - `asientos`: conteo de asientos vigentes del rango.
 */
export function computeKpiValues(
  periodAccounts: AccountMovement[],
  balanceAccounts: AccountMovement[],
  entryCount: number
): KpiValues {
  const income = sumByType(periodAccounts, ["Ingreso"]);
  const expenses = sumByType(periodAccounts, ["Gasto", "Costo"]);
  return {
    income,
    expenses,
    profit: round2(income - expenses),
    caja_bancos: sumByPrefix(balanceAccounts, "10"),
    por_cobrar: sumByPrefix(balanceAccounts, "12"),
    por_pagar: sumByPrefix(balanceAccounts, "42"),
    entries: entryCount,
  };
}

/** Construye las 7 tarjetas KPI con su variación vs el período anterior. */
export function buildDashboardKpis(input: DashboardInput): {
  kpis: Kpi[];
  previousPeriod: { from: string; to: string } | null;
} {
  const current = computeKpiValues(
    input.periodAccounts,
    input.balanceAccounts,
    input.entryCount
  );

  const previous = input.previous;
  const previousValues = previous
    ? computeKpiValues(previous.periodAccounts, previous.balanceAccounts, previous.entryCount)
    : null;

  // Sin datos previos en absoluto → no hay comparación (previousPeriod = null).
  const hasPrevious =
    previousValues !== null &&
    (previousValues.entries > 0 ||
      (Object.keys(previousValues) as (keyof KpiValues)[]).some(
        (key) => key !== "entries" && Math.abs(previousValues[key]) >= 0.005
      ));

  const kpis = (Object.keys(KPI_LABELS) as KpiKey[]).map((key): Kpi => {
    const kind: Kpi["kind"] = key === "entries" ? "count" : "currency";
    return {
      key,
      label: KPI_LABELS[key],
      value: key === "entries" ? current[key] : round2(current[key]),
      kind,
      variation: hasPrevious ? computeVariation(current[key], previousValues![key]) : null,
    };
  });

  return {
    kpis,
    previousPeriod:
      hasPrevious && previous ? { from: previous.from, to: previous.to } : null,
  };
}

/**
 * Construye el payload completo del dashboard (T005 KPIs + T013 serie,
 * distribución de gastos y top cuentas).
 */
export function buildDashboard(input: DashboardInput): DashboardPayload {
  const { kpis, previousPeriod } = buildDashboardKpis(input);

  // Un rango está "vacío" si no tiene asientos ni movimiento contable alguno.
  const hasMovement = input.accountMovement.some(
    (a) => Math.abs(a.debit) >= 0.005 || Math.abs(a.credit) >= 0.005
  );

  return {
    period: {
      from: input.from,
      to: input.to,
      label: formatRangeLabel(input.from, input.to),
    },
    previousPeriod,
    kpis,
    monthlySeries: buildMonthlySeries(input.from, input.to, input.monthlyRows),
    expenseBreakdown: buildExpenseBreakdown(input.periodAccounts),
    topAccounts: buildTopAccounts(input.accountMovement),
    meta: {
      currency: "PEN",
      empty: input.entryCount === 0 && !hasMovement,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    },
  };
}
