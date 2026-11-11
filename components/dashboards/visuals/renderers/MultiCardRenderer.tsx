import React from "react";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function MultiCardRenderer({
  data,
  format,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const metrics = data.meta.metrics;
  const firstRow = rows[0] || {};
  const decimals = format.numberFormat?.decimals ?? 2;
  const prefix = format.numberFormat?.prefix ?? "S/ ";

  return (
    <div className="flex flex-col justify-center divide-y divide-border/60 w-full h-full px-3 py-1 overflow-y-auto">
      {metrics.map((m) => {
        const val = Number(firstRow[m]) || 0;
        const formatted = val.toLocaleString("es-PE", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        const label = getMetricFriendlyLabel(m, fieldLabelsMap);
        return (
          <div key={m} className="flex items-center justify-between py-2 gap-3">
            <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
            <div className="text-base font-extrabold text-foreground flex items-baseline gap-0.5 shrink-0">
              {prefix && <span className="text-xs text-muted-foreground font-semibold">{prefix}</span>}
              <span>{formatted}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
