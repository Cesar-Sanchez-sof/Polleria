import React from "react";
import { calculateMatrixPivot } from "@/lib/dashboards/client-calculations";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function MatrixRenderer({
  data,
  format,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const pivot = calculateMatrixPivot(rows, axisKey, data.meta.legend, metrics);
  const decimals = format.numberFormat?.decimals ?? 2;

  return (
    <div className="w-full h-full overflow-auto text-xs">
      {pivot.exceeded && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] px-2 py-1 font-semibold">
          Vista limitada a 500 celdas para optimizar el rendimiento.
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/50 border-b border-border/80 sticky top-0 z-10">
            <th className="p-1.5 font-bold text-left border-r border-border/60 sticky left-0 bg-muted/90 z-20">
              {getMetricFriendlyLabel(axisKey, fieldLabelsMap)}
            </th>
            {pivot.colKeys.map((c) => (
              <th
                key={c}
                colSpan={metrics.length || 1}
                className="p-1.5 font-bold text-center border-r border-border/40 text-[11px]"
              >
                {c}
              </th>
            ))}
            <th
              colSpan={metrics.length || 1}
              className="p-1.5 font-bold text-center bg-muted/80 text-[11px]"
            >
              Total
            </th>
          </tr>
          {metrics.length > 1 && (
            <tr className="bg-muted/30 border-b border-border/60 text-[10px]">
              <th className="p-1 sticky left-0 bg-muted/80 z-20 border-r border-border/60" />
              {pivot.colKeys.map((c) =>
                metrics.map((m) => (
                  <th key={`${c}_${m}`} className="p-1 text-right border-r border-border/40 font-medium">
                    {getMetricFriendlyLabel(m, fieldLabelsMap)}
                  </th>
                ))
              )}
              {metrics.map((m) => (
                <th key={`total_${m}`} className="p-1 text-right font-medium">
                  {getMetricFriendlyLabel(m, fieldLabelsMap)}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-border/40">
          {pivot.rowKeys.map((r) => (
            <tr key={r} className="hover:bg-muted/15 transition-colors">
              <td className="p-1.5 font-semibold sticky left-0 bg-background/95 z-10 border-r border-border/60 whitespace-nowrap">
                {r}
              </td>
              {pivot.colKeys.map((c) =>
                metrics.map((m) => {
                  const val = pivot.grid[r]?.[c]?.[m] ?? 0;
                  return (
                    <td key={`${c}_${m}`} className="p-1.5 text-right tabular-nums border-r border-border/40">
                      {val.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                    </td>
                  );
                })
              )}
              {metrics.map((m) => {
                const rowTot = pivot.rowTotals[r]?.[m] ?? 0;
                return (
                  <td key={`tot_${m}`} className="p-1.5 text-right font-bold tabular-nums bg-muted/20">
                    {rowTot.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-muted/60 font-bold border-t-2 border-border/80 sticky bottom-0 z-10">
            <td className="p-1.5 sticky left-0 bg-muted/90 z-20 border-r border-border/60 font-black">
              Total General
            </td>
            {pivot.colKeys.map((c) =>
              metrics.map((m) => {
                const cTot = pivot.colTotals[c]?.[m] ?? 0;
                return (
                  <td key={`col_tot_${c}_${m}`} className="p-1.5 text-right tabular-nums border-r border-border/40 font-black">
                    {cTot.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                  </td>
                );
              })
            )}
            {metrics.map((m) => {
              const gTot = pivot.grandTotals[m] ?? 0;
              return (
                <td key={`grand_${m}`} className="p-1.5 text-right font-black tabular-nums bg-muted/80">
                  {gTot.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
