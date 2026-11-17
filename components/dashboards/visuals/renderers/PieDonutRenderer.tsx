import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";
import { calculateDonutAngles } from "@/lib/dashboards/format-utils";

export function PieDonutRenderer({
  visualType,
  data,
  format,
  palette,
  fieldLabelsMap,
  onCrossFilter,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";
  const isDonut = visualType === "donut";
  const legProps = getLegendProps(format.legend?.position);

  const customInner = format.chartSpecific?.donut?.innerRadius;
  const innerRadiusStr = isDonut ? `${customInner ?? 60}%` : "0%";

  const { startAngle, endAngle } = calculateDonutAngles(
    format.chartSpecific?.donut?.startAngle ?? 90
  );

  const pieData = rows.map((r, i) => {
    const rawVal = r.rawValue !== undefined && r.rawValue !== null ? r.rawValue : r[axisKey];
    const displayVal = String(r[axisKey] ?? `Elem ${i + 1}`);
    return {
      name: displayVal,
      value: Number(r[metricKey]) || 0,
      _field: axisKey,
      _rawValue: rawVal,
      _display: displayVal,
    };
  });

  const dataLabelsShow = format.dataLabels?.show;
  const dataLabelPos = format.dataLabels?.position || "outside";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          formatter={(val: unknown) => [
            Number(val).toLocaleString("es-PE"),
            getMetricFriendlyLabel(metricKey, fieldLabelsMap),
          ]}
        />
        {format.legend?.show && (
          <Legend
            verticalAlign={legProps.verticalAlign}
            align={legProps.align}
            layout={legProps.layout}
            iconType="circle"
            wrapperStyle={{ fontSize: "11px", padding: "4px" }}
          />
        )}
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={innerRadiusStr}
          outerRadius="80%"
          paddingAngle={isDonut ? 3 : 0}
          label={
            dataLabelsShow
              ? ({ name, percent }: { name?: string; percent?: number }) =>
                  dataLabelPos === "center"
                    ? `${((percent || 0) * 100).toFixed(0)}%`
                    : `${name} (${((percent || 0) * 100).toFixed(0)}%)`
              : false
          }
          labelLine={dataLabelsShow && dataLabelPos !== "center"}
          onClick={(entry: { name?: string; _field?: string; _rawValue?: unknown; _display?: string }) => {
            if (onCrossFilter && entry._field) {
              onCrossFilter(entry._field, entry._rawValue, entry._display || entry.name);
            }
          }}
          style={{ cursor: onCrossFilter ? "pointer" : "default" }}
        >
          {pieData.map((_, idx) => (
            <Cell key={`pie-cell-${idx}`} fill={palette[idx % palette.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
