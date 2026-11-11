import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";

export function PieDonutRenderer({
  visualType,
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";
  const isDonut = visualType === "donut";
  const legProps = getLegendProps(format.legend?.position);

  const pieData = rows.map((r, i) => ({
    name: String(r[axisKey] ?? `Elem ${i + 1}`),
    value: Number(r[metricKey]) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          formatter={(val: any) => [
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
          innerRadius={isDonut ? "55%" : 0}
          outerRadius="80%"
          paddingAngle={isDonut ? 3 : 0}
          label={format.dataLabels?.show ? ({ name, percent }: { name?: string; percent?: number }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)` : false}
          labelLine={format.dataLabels?.show}
        >
          {pieData.map((_, idx) => (
            <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
