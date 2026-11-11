import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

function CustomTreemapCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", fill = "#3b82f6" } = props;
  if (width < 30 || height < 20) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill, stroke: "#ffffff", strokeWidth: 2 }}
        rx={4}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={11}
        fontWeight="bold"
      >
        {name.length > Math.floor(width / 8) ? `${name.slice(0, Math.floor(width / 8))}...` : name}
      </text>
    </g>
  );
}

export function TreemapRenderer({
  data,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";

  const treemapData = rows.map((r, i) => ({
    name: String(r[axisKey] ?? `Item ${i + 1}`),
    size: Number(r[metricKey]) || 0,
    fill: palette[i % palette.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={treemapData}
        dataKey="size"
        nameKey="name"
        stroke="#ffffff"
        content={<CustomTreemapCell />}
        isAnimationActive={false}
      >
        <Tooltip
          formatter={(val: any) => [
            Number(val).toLocaleString("es-PE"),
            getMetricFriendlyLabel(metricKey, fieldLabelsMap),
          ]}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
