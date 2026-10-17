"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  formatCutOffDate,
  formatPen,
  type TrialBalanceStatement,
  type TrialBalanceLine,
} from "@/lib/services/trial-balance.service";
import { cn } from "@/lib/utils";

interface Props {
  statement: TrialBalanceStatement | null;
  loading: boolean;
  error: string | null;
}

function AmountCell({
  value,
  className,
}: Readonly<{ value: number; className?: string }>) {
  // Cero atenuado para que se lea de un vistazo el movimiento real.
  const isZero = Math.abs(value) < 0.005;
  return (
    <td className={cn("px-3 py-1.5 text-right tabular-nums text-xs", className)}>
      <span className={isZero ? "text-slate-300" : undefined}>{formatPen(value)}</span>
    </td>
  );
}

function lineRowClass(kind: TrialBalanceLine["kind"]): string {
  if (kind === "group") return "bg-slate-900 text-white";
  if (kind === "subgroup") return "bg-slate-100 font-semibold";
  return "hover:bg-slate-50/60";
}

/**
 * Tabla del Balance de Comprobación: columnas Balance inicial, periodo y final
 * (cada una con Debe / Haber), agrupada por elemento y sub-elemento PCGE.
 */
export function TrialBalanceTable({ statement, loading, error }: Readonly<Props>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generando balance de comprobación…
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

  if (!statement) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Selecciona un periodo para generar el balance de comprobación.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Estados financieros
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
          {statement.companyName}
        </h2>
        <h3 className="mt-0.5 text-base font-semibold text-slate-800">
          {statement.reportTitle}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Periodo: {statement.periodLabel} ({formatCutOffDate(statement.from)} al{" "}
          {formatCutOffDate(statement.to)}) · Expresado en {statement.currency} (Soles)
        </p>
      </header>

      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
          statement.balanced
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-amber-50 text-amber-900 border border-amber-200"
        )}
      >
        {statement.balanced ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        )}
        {statement.balanced ? (
          <span>
            Cuadra: Debe final ({formatPen(statement.totals.finalDebit)}) = Haber final (
            {formatPen(statement.totals.finalCredit)})
          </span>
        ) : (
          <span>
            Descuadre de {formatPen(statement.difference)}. Revisa asientos incompletos o cuentas
            mal clasificadas.
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th
                rowSpan={2}
                className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-24 border-r border-slate-700"
              >
                Cuenta
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider border-r border-slate-700"
              >
                Descripción
              </th>
              <th
                colSpan={2}
                className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider border-r border-slate-700"
              >
                Balance inicial
              </th>
              <th
                colSpan={2}
                className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider border-r border-slate-700"
              >
                {statement.periodLabel}
              </th>
              <th
                colSpan={2}
                className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider"
              >
                Balance final
              </th>
            </tr>
            <tr className="bg-slate-800 text-slate-200">
              <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                Debe
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                Haber
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                Debe
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                Haber
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                Debe
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider">
                Haber
              </th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => (
              <tr key={line.key} className={lineRowClass(line.kind)}>
                <td
                  className={cn(
                    "px-3 py-1.5 font-mono text-xs",
                    line.kind === "group" ? "text-slate-300" : "text-slate-500"
                  )}
                >
                  {line.code ?? ""}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-xs",
                    line.kind === "group"
                      ? "font-bold uppercase tracking-wide"
                      : line.kind === "subgroup"
                        ? "font-semibold text-slate-700"
                        : "text-slate-700"
                  )}
                >
                  <span style={{ paddingLeft: `${line.indent * 12}px` }}>{line.label}</span>
                </td>
                <AmountCell
                  value={line.amounts.initialDebit}
                  className={line.kind === "group" ? "font-semibold text-white" : undefined}
                />
                <AmountCell
                  value={line.amounts.initialCredit}
                  className={line.kind === "group" ? "font-semibold text-white" : undefined}
                />
                <AmountCell
                  value={line.amounts.periodDebit}
                  className={line.kind === "group" ? "font-semibold text-white" : undefined}
                />
                <AmountCell
                  value={line.amounts.periodCredit}
                  className={line.kind === "group" ? "font-semibold text-white" : undefined}
                />
                <AmountCell
                  value={line.amounts.finalDebit}
                  className={line.kind === "group" ? "font-semibold text-white" : undefined}
                />
                <AmountCell
                  value={line.amounts.finalCredit}
                  className={line.kind === "group" ? "font-semibold text-white" : undefined}
                />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white">
              <td colSpan={2} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">
                Total
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                {formatPen(statement.totals.initialDebit)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                {formatPen(statement.totals.initialCredit)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                {formatPen(statement.totals.periodDebit)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                {formatPen(statement.totals.periodCredit)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                {formatPen(statement.totals.finalDebit)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                {formatPen(statement.totals.finalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500 print:text-[9px]">
        {statement.normativeNote}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <SummaryChip label="Debe final" value={statement.totals.finalDebit} />
        <SummaryChip label="Haber final" value={statement.totals.finalCredit} />
        <SummaryChip
          label="Cuentas con actividad"
          value={statement.accountCount}
          display={String(statement.accountCount)}
        />
        <SummaryChip
          label="Diferencia final"
          value={statement.difference}
          emphasize={Math.abs(statement.difference) >= 0.005}
        />
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  display,
  emphasize,
}: Readonly<{ label: string; value: number; display?: string; emphasize?: boolean }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums",
          emphasize ? "text-red-700" : "text-slate-900"
        )}
      >
        {display ?? formatPen(value)}
      </p>
    </div>
  );
}
