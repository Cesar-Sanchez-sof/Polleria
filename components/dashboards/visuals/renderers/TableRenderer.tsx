import React from "react";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function TableRenderer({
  data,
  format,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const headers = [
    ...(data.meta.axis ? [axisKey] : []),
    ...(data.meta.legend ? [data.meta.legend] : []),
    ...metrics,
  ];

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-muted/40 sticky top-0 z-10">
            {headers.map((h) => (
              <th key={h} className="text-left font-semibold py-2 px-3 text-muted-foreground uppercase text-[10px]">
                {getMetricFriendlyLabel(h, fieldLabelsMap)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              {headers.map((h) => {
                const rawVal = r[h];
                const isNumeric = typeof rawVal === "number";
                return (
                  <td
                    key={h}
                    className={`py-2 px-3 whitespace-nowrap ${
                      isNumeric ? "text-right font-medium tabular-nums" : "text-foreground"
                    }`}
                  >
                    {isNumeric
                      ? rawVal.toLocaleString("es-PE", {
                          minimumFractionDigits: format.numberFormat?.decimals ?? 2,
                          maximumFractionDigits: format.numberFormat?.decimals ?? 2,
                        })
                      : String(rawVal ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
