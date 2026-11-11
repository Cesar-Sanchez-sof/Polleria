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
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";

export function ComboRenderer({
  config,
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const legProps = getLegendProps(format.legend?.position);

  const columnMetrics: string[] = [];
  const lineMetrics: string[] = [];

  config.data.values.forEach((v) => {
    const key = `${v.field}_${v.agg}`;
    if (v.series === "line") {
      lineMetrics.push(key);
    } else {
      columnMetrics.push(key);
    }
  });

  // Fallback si no hay series asignada
  if (columnMetrics.length === 0 && lineMetrics.length === 0) {
    if (metrics.length > 0) columnMetrics.push(metrics[0]);
    if (metrics.length > 1) lineMetrics.push(...metrics.slice(1));
  }

  const showSecondaryY = format.axes?.showSecondaryY && lineMetrics.length > 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 10, right: showSecondaryY ? 30 : 10, left: 10, bottom: 20 }}>
        {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          label={format.axes?.yTitle ? { value: format.axes.yTitle, angle: -90, position: "insideLeft", fontSize: 10 } : undefined}
        />
        {showSecondaryY && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            label={format.axes?.secondaryYTitle ? { value: format.axes.secondaryYTitle, angle: 90, position: "insideRight", fontSize: 10 } : undefined}
          />
        )}
        <Tooltip
          formatter={(val: any, name: any) => [
            Number(val).toLocaleString("es-PE"),
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
        {columnMetrics.map((m, idx) => (
          <Bar
            key={m}
            yAxisId="left"
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            fill={palette[idx % palette.length]}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
        {lineMetrics.map((m, idx) => (
          <Line
            key={m}
            yAxisId={showSecondaryY ? "right" : "left"}
            type="monotone"
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            stroke={palette[(columnMetrics.length + idx) % palette.length]}
            strokeWidth={3}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
