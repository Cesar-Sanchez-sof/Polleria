import React from "react";
import { sortDimensionKeys } from "@/lib/dashboards/client-calculations";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function HeatmapRenderer({
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const legendKey = data.meta.legend;
  const metricKey = metrics[0] || "";

  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const cellMap: Record<string, number> = {};
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const r of rows) {
    const rLabel = String(r[axisKey] ?? "(Vacío)");
    const cLabel = legendKey ? String(r[legendKey] ?? "(General)") : "Total";
    const v = Number(r[metricKey]) || 0;

    rowSet.add(rLabel);
    colSet.add(cLabel);
    cellMap[`${rLabel}__${cLabel}`] = v;

    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  if (minVal === Infinity) minVal = 0;
  if (maxVal === -Infinity) maxVal = 1;
  const valRange = maxVal - minVal || 1;

  // Orden estricto según la regla del registro (Item 4: weekday Lunes->Domingo, hourOfDay 00->23, fechas cronológicas)
  const distinctRows = sortDimensionKeys(Array.from(rowSet));
  const distinctCols = sortDimensionKeys(Array.from(colSet));
  const baseColor = palette[0] || "#3b82f6";
  const decimals = format.numberFormat?.decimals ?? 0;

  return (
    <div className="w-full h-full overflow-auto text-xs flex flex-col justify-between">
      <div className="overflow-auto max-h-[calc(100%-2rem)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 font-bold border-b border-border/80 sticky top-0 bg-background z-10 text-[10px] uppercase text-muted-foreground">
                {getMetricFriendlyLabel(axisKey, fieldLabelsMap)}
              </th>
              {distinctCols.map((col) => (
                <th
                  key={col}
                  className="p-1.5 font-semibold text-center border-b border-border/80 sticky top-0 bg-background z-10 text-[11px]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distinctRows.map((row) => (
              <tr key={row} className="border-b border-border/20">
                <td className="p-1.5 font-semibold text-muted-foreground whitespace-nowrap bg-background">
                  {row}
                </td>
                {distinctCols.map((col) => {
                  const val = cellMap[`${row}__${col}`] ?? 0;
                  const ratio = Math.max(0.08, Math.min(1, (val - minVal) / valRange));
                  return (
                    <td
                      key={`${row}_${col}`}
                      className="p-1 text-center font-bold tabular-nums rounded transition-colors"
                      style={{
                        backgroundColor: baseColor,
                        opacity: val > 0 ? ratio : 0.05,
                        color: ratio > 0.55 ? "#ffffff" : "#0f172a",
                      }}
                      title={`${row} × ${col}: ${val.toLocaleString("es-PE")}`}
                    >
                      {format.dataLabels?.show !== false && val > 0
                        ? val.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                        : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 px-2 pt-2 text-[10px] text-muted-foreground border-t border-border/40 shrink-0">
        <span>Bajo: {minVal.toLocaleString("es-PE")}</span>
        <div
          className="w-20 h-2 rounded"
          style={{
            background: `linear-gradient(to right, ${baseColor}22, ${baseColor})`,
          }}
        />
        <span>Alto: {maxVal.toLocaleString("es-PE")}</span>
      </div>
    </div>
  );
}
