import React from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus, Calendar } from "lucide-react";
import { calculateDeltaPercentage } from "@/lib/dashboards/client-calculations";
import { resolveDateRange, resolvePreviousRange, getLimaDateParts, formatUtcYmd } from "@/lib/dashboards/date-utils";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function KpiTrendRenderer({
  config,
  data,
  previousData,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";
  const lastRow = rows[rows.length - 1] || rows[0] || {};
  const currentVal = Number(lastRow[metricKey]) || 0;

  const prevRows = previousData?.rows || [];
  const prevLastRow = prevRows[prevRows.length - 1] || prevRows[0] || {};
  const previousVal = Number(prevLastRow[metricKey]) || 0;

  const delta = calculateDeltaPercentage(currentVal, previousVal);
  const decimals = format.numberFormat?.decimals ?? 2;
  const prefix = format.numberFormat?.prefix ?? "S/ ";
  const displayStr = currentVal.toLocaleString("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const hasSparkline = rows.length > 1 && Boolean(data.meta.axis);
  const sparkData = hasSparkline
    ? rows.map((r, i) => ({
        idx: i,
        name: String(r[axisKey] ?? i),
        val: Number(r[metricKey]) || 0,
      }))
    : [];

  const sparkColor = palette[0] || "#3b82f6";

  // Calcular descripción textual de los rangos comparados
  let compareTooltip = "";
  if (config.data.dateRange) {
    const dr = config.data.dateRange;
    let currStart: string;
    let currEnd: string;
    if (dr.preset === "thisMonth") {
      const parts = getLimaDateParts(new Date());
      const yStr = String(parts.year);
      const mStr = String(parts.month).padStart(2, "0");
      const dStr = String(parts.day).padStart(2, "0");
      currStart = `${yStr}-${mStr}-01`;
      currEnd = `${yStr}-${mStr}-${dStr}`;
    } else if (dr.preset === "thisYear") {
      const parts = getLimaDateParts(new Date());
      const yStr = String(parts.year);
      const mStr = String(parts.month).padStart(2, "0");
      const dStr = String(parts.day).padStart(2, "0");
      currStart = `${yStr}-01-01`;
      currEnd = `${yStr}-${mStr}-${dStr}`;
    } else {
      [currStart, currEnd] = resolveDateRange(dr);
    }
    const [prevStart, prevEnd] = resolvePreviousRange(dr);
    compareTooltip = `Actual: ${currStart} al ${currEnd} | Previo: ${prevStart} al ${prevEnd}`;
  }

  return (
    <div className="flex flex-col justify-between w-full h-full p-2" title={compareTooltip}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {getMetricFriendlyLabel(metricKey, fieldLabelsMap)}
          </span>
          <div className="text-3xl font-black tracking-tight text-foreground flex items-baseline gap-1 mt-0.5">
            {prefix && <span className="text-xl font-semibold text-muted-foreground">{prefix}</span>}
            <span>{displayStr}</span>
          </div>
        </div>

        {delta.formatted !== "—" ? (
          <div
            title={compareTooltip}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-colors ${
              delta.direction === "up"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : delta.direction === "down"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {delta.direction === "up" && <ArrowUpRight className="w-3.5 h-3.5" />}
            {delta.direction === "down" && <ArrowDownRight className="w-3.5 h-3.5" />}
            {delta.direction !== "up" && delta.direction !== "down" && <Minus className="w-3.5 h-3.5" />}
            <span>{delta.formatted}</span>
          </div>
        ) : (
          <div
            title={compareTooltip || "Sin datos del período anterior"}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border/60"
          >
            <span>—</span>
          </div>
        )}
      </div>

      {compareTooltip && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1" title={compareTooltip}>
          <Calendar className="w-3 h-3 text-muted-foreground/60" />
          <span className="truncate">{compareTooltip}</span>
        </div>
      )}

      {hasSparkline ? (
        <div className="w-full h-14 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-spark-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparkColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={sparkColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke={sparkColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-spark-${metricKey})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}
