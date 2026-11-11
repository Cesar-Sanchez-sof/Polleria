import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { calculateParetoData } from "@/lib/dashboards/client-calculations";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";

export function ParetoRenderer({
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";
  const paretoData = calculateParetoData(rows, axisKey, metricKey);
  const legProps = getLegendProps(format.legend?.position);

  const barColor = palette[0] || "#3b82f6";
  const lineColor = "#f59e0b"; // Ámbar/dorado para la línea de Pareto

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={paretoData} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
        {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          label={{ value: "Valor", angle: -90, position: "insideLeft", fontSize: 10 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
          label={{ value: "% Acumulado", angle: 90, position: "insideRight", fontSize: 10 }}
        />
        <Tooltip
          formatter={(val: any, name: any) => [
            name === "% Acumulado" ? `${val}%` : Number(val).toLocaleString("es-PE"),
            name === "% Acumulado" ? "% Acumulado" : getMetricFriendlyLabel(metricKey, fieldLabelsMap),
          ]}
        />
        {format.legend?.show && (
          <Legend
            verticalAlign={legProps.verticalAlign}
            align={legProps.align}
            layout={legProps.layout}
            wrapperStyle={{ fontSize: "11px", paddingBottom: "4px" }}
          />
        )}
        <Bar
          yAxisId="left"
          dataKey="value"
          name={getMetricFriendlyLabel(metricKey, fieldLabelsMap)}
          fill={barColor}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulativePercentage"
          name="% Acumulado"
          stroke={lineColor}
          strokeWidth={3}
          dot={{ r: 4, fill: lineColor }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
