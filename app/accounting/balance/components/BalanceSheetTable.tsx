"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  formatCutOffDate,
  formatPen,
  type BalanceSheetStatement,
} from "@/lib/services/balance-sheet.service";
import { cn } from "@/lib/utils";

interface Props {
  statement: BalanceSheetStatement | null;
  loading: boolean;
  error: string | null;
}

function amountClass(kind: string, amount: number | null): string {
  if (amount === null) return "";
  if (kind === "total") return "font-bold text-slate-900";
  if (kind === "subtotal") return "font-semibold text-slate-800";
  if (amount < 0) return "tabular-nums text-red-700";
  return "tabular-nums text-slate-800";
}

/**
 * Tabla del Estado de Situación Financiera (PCGE / SUNAT).
 */
export function BalanceSheetTable({ statement, loading, error }: Readonly<Props>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generando Estado de Situación Financiera…
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
        Selecciona una fecha de corte para generar el balance.
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
          Al {formatCutOffDate(statement.asOf)} · Expresado en {statement.currency} (Soles)
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
            Cuadra: Activo ({formatPen(statement.totals.totalAssets)}) = Pasivo + Patrimonio (
            {formatPen(statement.totals.totalLiabilitiesAndEquity)})
          </span>
        ) : (
          <span>
            Descuadre de {formatPen(statement.difference)}. Revisa asientos incompletos o cuentas
            mal clasificadas.
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-24">
                Cuenta
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider w-40">
                Importe (S/)
              </th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => {
              if (line.kind === "note") {
                return (
                  <tr key={line.key} className="bg-slate-50/80">
                    <td colSpan={3} className="px-3 py-1.5 text-[10px] italic text-slate-500">
                      <span style={{ paddingLeft: `${line.indent * 12}px` }}>{line.label}</span>
                    </td>
                  </tr>
                );
              }

              const rowClass =
                line.kind === "section"
                  ? "bg-slate-100"
                  : line.kind === "total"
                    ? "bg-slate-900 text-white"
                    : line.kind === "subtotal"
                      ? "bg-slate-50 border-t border-slate-200"
                      : "hover:bg-slate-50/60";

              const labelClass =
                line.kind === "section"
                  ? "font-bold uppercase tracking-wide text-slate-900"
                  : line.kind === "total"
                    ? "font-bold uppercase tracking-wide"
                    : line.kind === "subsection"
                      ? "font-semibold text-slate-700"
                      : line.kind === "subtotal"
                        ? "font-semibold text-slate-700"
                        : "text-slate-700";

              return (
                <tr key={line.key} className={rowClass}>
                  <td
                    className={cn(
                      "px-3 py-1.5 font-mono text-xs",
                      line.kind === "total" ? "text-slate-300" : "text-slate-500"
                    )}
                  >
                    {line.code ?? ""}
                  </td>
                  <td className={cn("px-3 py-1.5", labelClass)}>
                    <span style={{ paddingLeft: `${line.indent * 12}px` }}>{line.label}</span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right",
                      line.kind === "total"
                        ? "font-bold tabular-nums"
                        : amountClass(line.kind, line.amount)
                    )}
                  >
                    {line.amount === null ? "" : formatPen(line.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500 print:text-[9px]">
        {statement.normativeNote}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <SummaryChip label="Activo corriente" value={statement.totals.currentAssets} />
        <SummaryChip label="Activo no corriente" value={statement.totals.nonCurrentAssets} />
        <SummaryChip label="Pasivo total" value={statement.totals.totalLiabilities} />
        <SummaryChip
          label="Resultado del ejercicio"
          value={statement.totals.periodResult}
          emphasize
        />
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
