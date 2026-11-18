import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

interface TreemapEntry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
  _field?: string;
  _rawValue?: unknown;
}

function CustomTreemapCell(props: TreemapEntry & { onClick?: (entry: TreemapEntry) => void }) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", fill = "#3b82f6", onClick } = props;
  if (width < 30 || height < 20) return null;

  return (
    <g
      style={{ cursor: onClick ? "pointer" : "default" }}
      onClick={() => onClick && onClick(props)}
    >
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
  onCrossFilter,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";

  const treemapData = rows.map((r, i) => {
    const rawVal = r.rawValue !== undefined && r.rawValue !== null ? r.rawValue : r[axisKey];
    const displayVal = String(r[axisKey] ?? `Item ${i + 1}`);
    return {
      name: displayVal,
      size: Number(r[metricKey]) || 0,
      fill: palette[i % palette.length],
      _field: axisKey,
      _rawValue: rawVal,
      _display: displayVal,
    };
  });

  const handleCellClick = (entry: TreemapEntry) => {
    if (!onCrossFilter || !entry._field) return;
    onCrossFilter(entry._field, entry._rawValue, entry.name);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={treemapData}
        dataKey="size"
        nameKey="name"
        stroke="#ffffff"
        content={<CustomTreemapCell onClick={handleCellClick} />}
        isAnimationActive={false}
      >
        <Tooltip
          formatter={(val: unknown) => [
            Number(val).toLocaleString("es-PE"),
            getMetricFriendlyLabel(metricKey, fieldLabelsMap),
          ]}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
