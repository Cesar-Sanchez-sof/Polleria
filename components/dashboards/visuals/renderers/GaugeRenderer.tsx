import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { VisualRendererProps } from "./renderer-types";

export function GaugeRenderer({
  data,
  format,
  palette,
}: VisualRendererProps) {
  const rows = data.rows;
  const metrics = data.meta.metrics;
  const firstRow = rows[0] || {};
  const currentVal = Number(metrics.length > 0 ? firstRow[metrics[0]] : 0) || 0;

  const minVal = format.gauge?.min ?? 0;
  const maxVal = format.gauge?.max ?? (currentVal > 0 ? currentVal * 1.5 : 100);
  const targetVal = format.gauge?.target;
  const clampedVal = Math.min(Math.max(currentVal, minVal), maxVal);
  const percent = maxVal > minVal ? ((clampedVal - minVal) / (maxVal - minVal)) * 100 : 0;

  const decimals = format.numberFormat?.decimals ?? 1;
  const prefix = format.numberFormat?.prefix ?? "S/ ";
  const displayVal = currentVal.toLocaleString("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const gaugeData = [
    { name: "Progreso", value: clampedVal - minVal },
    { name: "Restante", value: maxVal - clampedVal },
  ];
  const gaugeColor = palette[0] || "#3b82f6";
  const trackColor = "#e2e8f0";

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative">
      <div className="w-full h-full flex items-center justify-center relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="95%"
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={gaugeColor} />
              <Cell fill={trackColor} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute top-[52%] flex flex-col items-center pointer-events-none">
          <div className="text-2xl font-black text-foreground flex items-baseline gap-0.5">
            {prefix && <span className="text-sm font-semibold text-muted-foreground">{prefix}</span>}
            <span>{displayVal}</span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {Math.round(percent)}%
          </span>
          {targetVal !== undefined && (
            <span className="text-[10px] text-muted-foreground/80">
              Meta: {prefix}{targetVal}
            </span>
          )}
        </div>
      </div>

      <div className="w-full flex justify-between px-6 text-[10px] font-bold text-muted-foreground -mt-3">
        <span>{prefix}{minVal}</span>
        <span>{prefix}{Math.round(maxVal)}</span>
      </div>
    </div>
  );
}
