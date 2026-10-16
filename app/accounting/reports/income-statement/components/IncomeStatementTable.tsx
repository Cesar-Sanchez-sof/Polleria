"use client";

import { AlertTriangle, Info, Loader2 } from "lucide-react";
import {
  formatPeriodLabel,
  formatPen,
  type IncomeStatementResult,
} from "@/lib/services/income-statement-api.service";
import { cn } from "@/lib/utils";

interface Props {
  result: IncomeStatementResult | null;
  loading: boolean;
  error: string | null;
}

type RowKind = "section" | "account" | "subtotal" | "total";

interface ReportRow {
  key: string;
  kind: RowKind;
  /** Cuentas PCGE que originan la línea (SC-005). */
  code?: string;
  label: string;
  /** Negativo para las líneas que se restan (costo, gastos, impuesto). */
  amount: number;
}

/**
 * Construye las líneas del reporte a partir del resultado.
 *
 * Convención de signo: las líneas que se restan (costo de ventas, gastos e impuesto) se muestran
 * en negativo, de modo que la suma vertical de cualquier bloque coincide con su subtotal.
 */
function buildRows(r: IncomeStatementResult): ReportRow[] {
  return [
    { key: "s-ingresos", kind: "section", label: "Ingresos de operación", amount: 0 },
    {
      key: "ordinarios",
      kind: "account",
      code: "70 · 701 · 702 · 704",
      label: "Ingresos ordinarios por ventas y servicios",
      amount: r.operating_income.ordinary_income,
    },
    {
      key: "subarriendo",
      kind: "account",
      code: "75 · 76",
      label: "Ingresos por subarrendamiento y otros",
      amount: r.operating_income.sublease_and_other_income,
    },
    {
      key: "t-ingresos",
      kind: "subtotal",
      code: "",
      label: "Total ingresos de operación",
      amount: r.operating_income.total,
    },
    { key: "s-costo", kind: "section", label: "Costo de ventas", amount: 0 },
    {
      key: "costo",
      kind: "account",
      code: "69",
      label: "Costo de ventas de mercaderías y servicios vendidos",
      amount: -r.sales_costs.cost_of_goods_sold,
    },
    {
      key: "bruta",
      kind: "subtotal",
      code: "",
      label: "Utilidad bruta",
      amount: r.gross_profit.amount,
    },
    { key: "s-gastos", kind: "section", label: "Gastos de operación", amount: 0 },
    {
      key: "distribucion",
      kind: "account",
      code: "95",
      label: "Gastos de distribución y ventas",
      amount: -r.operating_expenses.distribution,
    },
    {
      key: "administracion",
      kind: "account",
      code: "94",
      label: "Gastos de administración y generales",
      amount: -r.operating_expenses.administrative,
    },
    {
      key: "t-gastos",
      kind: "subtotal",
      code: "",
      label: "Total gastos de operación",
      amount: -r.operating_expenses.total,
    },
    {
      key: "operativa",
      kind: "subtotal",
      code: "",
      label: "Utilidad de operación",
      amount: r.operating_profit.amount,
    },
    {
      key: "s-otras",
      kind: "section",
      label: "Otros ingresos, gastos y partidas financieras",
      amount: 0,
    },
    {
      key: "otros-ingresos",
      kind: "account",
      code: "75 · 76",
      label: "Otros ingresos operativos y no financieros",
      amount: r.other_revenues_and_expenses.revenues,
    },
    {
      key: "otros-gastos",
      kind: "account",
      code: "65 · 66",
      label: "Otros gastos operativos y no financieros",
      amount: -r.other_revenues_and_expenses.expenses,
    },
    {
      key: "cambio",
      kind: "account",
      code: "776 · 676",
      label: "Diferencia de cambio, neta",
      amount: r.exchange_difference_net.amount,
    },
    {
      key: "ing-fin",
      kind: "account",
      code: "77",
      label: "Ingresos financieros",
      amount: r.financial_income.amount,
    },
    {
      key: "gas-fin",
      kind: "account",
      code: "67",
      label: "Gastos financieros",
      amount: -r.financial_expenses.amount,
    },
    {
      key: "antes-imp",
      kind: "subtotal",
      code: "",
      label: "Resultado antes de impuestos a la renta",
      amount: r.result_before_taxes.amount,
    },
    {
      key: "impuesto",
      kind: "account",
      code: "88",
      label: "Impuesto a la renta",
      amount: -r.income_tax_expense.amount,
    },
    {
      key: "neto",
      kind: "total",
      code: "",
      label: "Resultado neto del periodo",
      amount: r.net_profit.amount,
    },
  ];
}

function rowClasses(kind: RowKind): string {
  if (kind === "section") return "bg-slate-100";
  if (kind === "total") return "bg-slate-900 text-white";
  if (kind === "subtotal") return "bg-slate-50 border-t border-slate-200";
  return "hover:bg-slate-50/60";
}

function labelClasses(kind: RowKind): string {
  if (kind === "section") return "font-bold uppercase tracking-wide text-slate-900";
  if (kind === "total") return "font-bold uppercase tracking-wide";
  if (kind === "subtotal") return "font-semibold text-slate-700";
  return "text-slate-700";
}

function amountClasses(kind: RowKind, amount: number): string {
  if (kind === "total") return "font-bold tabular-nums";
  if (kind === "subtotal") return "font-semibold tabular-nums text-slate-900";
  if (amount < 0) return "tabular-nums text-red-700";
  return "tabular-nums text-slate-800";
}

/** Estado vacío: el periodo no tiene movimientos contables. */
function isBlank(result: IncomeStatementResult): boolean {
  const { operating_income, sales_costs, operating_expenses, net_profit, financial_expenses } =
    result;
  return (
    operating_income.total === 0 &&
    sales_costs.cost_of_goods_sold === 0 &&
    operating_expenses.total === 0 &&
    financial_expenses.amount === 0 &&
    net_profit.amount === 0
  );
}

/**
 * Tabla del Estado de Resultados por Función (PCGE 2019 / NIIF).
 */
export function IncomeStatementTable({ result, loading, error }: Readonly<Props>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generando Estado de Resultados…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Selecciona un periodo para generar el Estado de Resultados.
      </div>
    );
  }

  const rows = buildRows(result);
  const grossMargin =
    result.operating_income.total === 0
      ? 0
      : (result.gross_profit.amount / result.operating_income.total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Estados financieros
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
          Estado de Resultados por Función
        </h2>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">PCGE 2019 · NIIF</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatPeriodLabel(result.period.start_date, result.period.end_date)} · Expresado en{" "}
          {result.currency} (Soles)
        </p>
      </header>

      {isBlank(result) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            El periodo no registra movimientos contables: todas las líneas se muestran en S/ 0.00.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-56">
                Cuentas PCGE
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">
                Concepto
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider w-40">
                Importe (S/)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const showCode = row.kind === "account";
              return (
                <tr key={row.key} className={rowClasses(row.kind)}>
                  <td
                    className={cn(
                      "px-3 py-1.5 font-mono text-xs",
                      row.kind === "total" ? "text-slate-300" : "text-slate-500"
                    )}
                  >
                    {showCode ? (row.code ?? "") : ""}
                  </td>
                  <td className={cn("px-3 py-1.5", labelClasses(row.kind))}>{row.label}</td>
                  <td className={cn("px-3 py-1.5 text-right", amountClasses(row.kind, row.amount))}>
                    {row.kind === "section" ? "" : formatPen(row.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500 print:text-[9px]">
        Calculado con asientos vigentes del periodo. Ingresos de operación = Cuenta 70 (701, 702,
        704…) menos las cuentas deudoras 709 y 74; costo de ventas = saldo deudor de la Cuenta 69;
        gastos de distribución y administración = Cuentas 95 y 94; otros ingresos y gastos =
        Cuentas 75/76 menos 65/66; diferencia de cambio = 776 menos 676; ingresos y gastos
        financieros = 77 y 67; impuesto a la renta = Cuenta 88. La Cuenta 60 (compras) no integra
        el costo de ventas.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <SummaryChip label="Ingresos de operación" value={result.operating_income.total} />
        <SummaryChip
          label={`Utilidad bruta (${grossMargin.toFixed(1)}%)`}
          value={result.gross_profit.amount}
        />
        <SummaryChip label="Gastos de operación" value={-result.operating_expenses.total} />
        <SummaryChip label="Resultado neto" value={result.net_profit.amount} emphasize />
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  emphasize,
}: Readonly<{ label: string; value: number; emphasize?: boolean }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums",
          emphasize && value < 0 ? "text-red-700" : "text-slate-900"
        )}
      >
        {formatPen(value)}
      </p>
    </div>
  );
}
