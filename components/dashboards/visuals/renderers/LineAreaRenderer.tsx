import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";

export function LineAreaRenderer({
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

  if (visualType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
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
          {metrics.map((m, idx) => (
            <Line
              key={m}
              type="monotone"
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              stroke={palette[idx % palette.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Area o stackedArea
  const isStacked = visualType === "stackedArea";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        {format.axes.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
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
        {metrics.map((m, idx) => (
          <Area
            key={m}
            type="monotone"
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            stroke={palette[idx % palette.length]}
            fill={palette[idx % palette.length]}
            fillOpacity={0.3}
            stackId={isStacked ? "stackArea" : undefined}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
