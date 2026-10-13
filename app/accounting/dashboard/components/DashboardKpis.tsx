"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Kpi } from "@/lib/services/dashboard.service";
import { formatPen } from "@/lib/services/dashboard.service";

/** Formatea el valor del KPI según su tipo (moneda PEN o contador). */
function formatValue(kpi: Kpi): string {
  if (kpi.kind === "count") return new Intl.NumberFormat("es-PE").format(kpi.value);
  return formatPen(kpi.value);
}

function VariationBadge({ kpi }: { kpi: Kpi }) {
  if (kpi.variation === null) {
    return (
      <span className="text-[11px] text-muted-foreground">Sin comparación</span>
    );
  }

  const { percent, direction } = kpi.variation;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const tone =
    direction === "up"
      ? "bg-emerald-50 text-emerald-700"
      : direction === "down"
        ? "bg-red-50 text-red-700"
        : "bg-slate-100 text-slate-500";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}
      title="Variación respecto del período anterior"
    >
      <Icon className="h-3 w-3" />
      {Math.abs(percent).toLocaleString("es-PE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })}
      %
    </span>
  );
}

interface DashboardKpisProps {
  kpis: Kpi[];
}

/** Tarjetas KPI del período con su variación vs el período anterior (US1). */
export function DashboardKpis({ kpis }: Readonly<DashboardKpisProps>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {kpis.map((kpi) => {
        // Pérdida (utilidad negativa): semántica de color sin mostrar montos confusos.
        const isLoss = kpi.key === "utilidad" && kpi.value < 0;
        return (
          <div
            key={kpi.key}
            className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-2 min-w-0"
          >
            <span className="text-xs font-medium text-muted-foreground truncate">
              {kpi.label}
            </span>
            <span
              className={`text-lg font-bold truncate ${isLoss ? "text-red-700" : "text-slate-900"}`}
            >
              {isLoss ? `−${formatValue({ ...kpi, value: Math.abs(kpi.value) })}` : formatValue(kpi)}
            </span>
            <VariationBadge kpi={kpi} />
          </div>
        );
      })}
    </div>
  );
}
