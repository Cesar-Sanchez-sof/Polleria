import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { calculateWaterfallData } from "@/lib/dashboards/client-calculations";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function WaterfallRenderer({
  data,
  format,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";
  const waterfallData = calculateWaterfallData(rows, axisKey, metricKey);

  const posColor = "#10b981"; // Verde esmeralda para incrementos
  const negColor = "#ef4444"; // Rojo para decrementos
  const totColor = "#3b82f6"; // Azul para total acumulado

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={waterfallData} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
        {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(_: unknown, __: unknown, item: any) => [
            (item?.payload?.displayValue ?? 0).toLocaleString("es-PE"),
            getMetricFriendlyLabel(metricKey, fieldLabelsMap),
          ]}
        />
        {/* Barra invisible de offset / flotante */}
        <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
        {/* Barra visible de magnitud */}
        <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {waterfallData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.isTotal
                  ? totColor
                  : entry.type === "positive"
                    ? posColor
                    : negColor
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
