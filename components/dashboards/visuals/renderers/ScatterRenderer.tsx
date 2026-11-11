import React from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function ScatterRenderer({
  config,
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;

  const xValField = config.data.values.find((v) => v.series === "x") || config.data.values[0];
  const yValField = config.data.values.find((v) => v.series === "y") || config.data.values[1];
  const sizeValField = config.data.values.find((v) => v.series === "size") || config.data.values[2];

  const xKey = xValField ? `${xValField.field}_${xValField.agg}` : metrics[0] || "x";
  const yKey = yValField ? `${yValField.field}_${yValField.agg}` : metrics[1] || "y";
  const sizeKey = sizeValField ? `${sizeValField.field}_${sizeValField.agg}` : undefined;

  const scatterData = rows.map((r, i) => ({
    name: String(r[axisKey] ?? `Punto ${i + 1}`),
    x: Number(r[xKey]) || 0,
    y: Number(r[yKey]) || 0,
    z: sizeKey ? Number(r[sizeKey]) || 10 : 10,
  }));

  const bubbleColor = palette[0] || "#3b82f6";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
        {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis
          type="number"
          dataKey="x"
          name={getMetricFriendlyLabel(xKey, fieldLabelsMap)}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={getMetricFriendlyLabel(yKey, fieldLabelsMap)}
          tick={{ fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="z" range={[60, 400]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(val: any, name: any) => [
            Number(val).toLocaleString("es-PE"),
            name === "x"
              ? getMetricFriendlyLabel(xKey, fieldLabelsMap)
              : name === "y"
                ? getMetricFriendlyLabel(yKey, fieldLabelsMap)
                : String(name),
          ]}
        />
        <Scatter name="Datos" data={scatterData} fill={bubbleColor} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
