import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";

export function BarColumnRenderer({
  visualType,
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const legProps = getLegendProps(format.legend?.position);

  const isBar = visualType === "bar" || visualType === "stackedBar" || visualType === "percentBar";
  const isStacked = visualType === "stackedBar" || visualType === "stackedColumn";
  const isPercent = visualType === "percentBar" || visualType === "percentColumn";

  if (isBar) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          stackOffset={isPercent ? "expand" : undefined}
          margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
        >
          {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={isPercent ? (v) => `${Math.round(v * 100)}%` : undefined}
          />
          <YAxis dataKey={axisKey} type="category" tick={{ fontSize: 11 }} width={80} />
          <Tooltip
            formatter={(val: any, name: any) => [
              isPercent ? `${(Number(val) * 100).toFixed(1)}%` : Number(val).toLocaleString("es-PE"),
              getMetricFriendlyLabel(String(name), fieldLabelsMap),
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
          {metrics.map((m, idx) => (
            <Bar
              key={m}
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              fill={palette[idx % palette.length]}
              stackId={isStacked || isPercent ? "stackA" : undefined}
              radius={isStacked || isPercent ? [0, 0, 0, 0] : [0, 4, 4, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Columnas verticales (column, stackedColumn, percentColumn)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        stackOffset={isPercent ? "expand" : undefined}
        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
      >
        {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={isPercent ? (v) => `${Math.round(v * 100)}%` : undefined}
        />
        <Tooltip
          formatter={(val: any, name: any) => [
            isPercent ? `${(Number(val) * 100).toFixed(1)}%` : Number(val).toLocaleString("es-PE"),
            getMetricFriendlyLabel(String(name), fieldLabelsMap),
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
        {metrics.map((m, idx) => (
          <Bar
            key={m}
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            fill={palette[idx % palette.length]}
            stackId={isStacked || isPercent ? "stackA" : undefined}
            radius={isStacked || isPercent ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
