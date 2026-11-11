import React from "react";
import type { VisualRendererProps } from "./renderer-types";

export function CardRenderer({ data, format }: VisualRendererProps) {
  const rows = data.rows;
  const metrics = data.meta.metrics;
  const firstRow = rows[0] || {};
  const metricVal = metrics.length > 0 ? firstRow[metrics[0]] : 0;
  const num = Number(metricVal) || 0;

  const decimals = format.numberFormat?.decimals ?? 2;
  const prefix = format.numberFormat?.prefix ?? "S/ ";
  const compact = format.numberFormat?.compact ?? false;

  let displayStr: string;
  if (compact) {
    if (Math.abs(num) >= 1_000_000) {
      displayStr = `${(num / 1_000_000).toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}M`;
    } else if (Math.abs(num) >= 1_000) {
      displayStr = `${(num / 1_000).toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}K`;
    } else {
      displayStr = num.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
  } else {
    displayStr = num.toLocaleString("es-PE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="text-3xl font-extrabold tracking-tight text-foreground flex items-baseline gap-1">
        {prefix && <span className="text-xl font-semibold text-muted-foreground">{prefix}</span>}
        <span>{displayStr}</span>
      </div>
      {format.axes?.yTitle && (
        <p className="text-xs text-muted-foreground mt-1 font-medium">{format.axes.yTitle}</p>
      )}
    </div>
  );
}
