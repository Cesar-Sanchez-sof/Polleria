"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  formatPen,
  formatPercent,
  formatNumber,
  formatYear,
  type ExecutiveSummary,
  type ExecutiveMetric,
} from "@/lib/services/executive-summary.service";
import { cn } from "@/lib/utils";

interface Props {
  summary: ExecutiveSummary | null;
  loading: boolean;
  error: string | null;
}

function formatMetric(metric: ExecutiveMetric): string {
  if (metric.format === "currency") return formatPen(metric.value);
  if (metric.format === "percent") return formatPercent(metric.value);
  return formatNumber(metric.value);
}

/** Un valor se atenúa cuando es cero y se marca en rojo cuando es negativo. */
function valueClass(metric: ExecutiveMetric): string {
  if (Math.abs(metric.value) < 0.005) return "text-slate-300";
  if (metric.value < 0) return "text-red-700";
  return "text-slate-900";
}

/**
 * Panel del Resumen Ejecutivo: cinco bloques (efectivo, rentabilidad, balance
 * general, rendimiento y posición) con sus métricas clave del ejercicio.
 */
export function ExecutiveSummaryPanel({ summary, loading, error }: Readonly<Props>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generando resumen ejecutivo…
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

  if (!summary) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Selecciona un año para generar el resumen ejecutivo.
      </div>
    );
  }

  const hasNegativeKeyMetric =
    summary.totals.netProfit < 0 ||
    summary.totals.netAssets < 0 ||
    summary.totals.cashClosingBalance < 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-slate-200 pb-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Estados financieros
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
          {summary.companyName}
        </h2>
        <h3 className="mt-0.5 text-base font-semibold text-slate-800">
          {summary.reportTitle}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Ejercicio {formatYear(summary.year)} · Expresado en {summary.currency} (Soles)
        </p>
      </header>

      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
          hasNegativeKeyMetric
            ? "bg-amber-50 text-amber-900 border border-amber-200"
            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
        )}
      >
        {hasNegativeKeyMetric ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        )}
        {hasNegativeKeyMetric ? (
          <span>
            El ejercicio presenta resultados negativos: ganancia neta (
            {formatPen(summary.totals.netProfit)}), activos netos (
            {formatPen(summary.totals.netAssets)}) o saldo de efectivo de cierre (
            {formatPen(summary.totals.cashClosingBalance)}).
          </span>
        ) : (
          <span>
            Ejercicio saludable: ganancia neta de {formatPen(summary.totals.netProfit)} y activos
            netos de {formatPen(summary.totals.netAssets)}.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-1">
        {summary.sections.map((section) => (
          <section
            key={section.key}
            className="overflow-hidden rounded-lg border border-slate-200"
          >
            <h4 className="bg-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              {section.label}
            </h4>
            <dl className="divide-y divide-slate-100">
              {section.metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="flex items-baseline justify-between gap-3 px-3 py-2"
                >
                  <dt className="text-xs text-slate-600">
                    {metric.label}
                    {metric.hint ? (
                      <span className="ml-1 text-[10px] text-slate-400">({metric.hint})</span>
                    ) : null}
                  </dt>
                  <dd
                    className={cn(
                      "shrink-0 text-xs font-semibold tabular-nums",
                      valueClass(metric)
                    )}
                  >
                    {formatMetric(metric)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500 print:text-[9px]">
        {summary.normativeNote}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <SummaryChip label="Ingresos" value={formatPen(summary.totals.income)} />
        <SummaryChip
          label="Ganancia neta"
          value={formatPen(summary.totals.netProfit)}
          emphasize={summary.totals.netProfit < 0}
        />
        <SummaryChip
          label="Activos netos"
          value={formatPen(summary.totals.netAssets)}
          emphasize={summary.totals.netAssets < 0}
        />
        <SummaryChip
          label="Efectivo de cierre"
          value={formatPen(summary.totals.cashClosingBalance)}
          emphasize={summary.totals.cashClosingBalance < 0}
        />
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  emphasize,
}: Readonly<{ label: string; value: string; emphasize?: boolean }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums",
          emphasize ? "text-red-700" : "text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}
