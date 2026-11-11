import React from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";

export function RadarRenderer({
  data,
  format,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const legProps = getLegendProps(format.legend?.position);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={rows}>
        <PolarGrid />
        <PolarAngleAxis dataKey={axisKey} tick={{ fontSize: 10 }} />
        <PolarRadiusAxis tick={{ fontSize: 9 }} />
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
            wrapperStyle={{ fontSize: "11px" }}
          />
        )}
        {metrics.map((m, idx) => (
          <Radar
            key={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            dataKey={m}
            stroke={palette[idx % palette.length]}
            fill={palette[idx % palette.length]}
            fillOpacity={0.4}
            isAnimationActive={false}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
