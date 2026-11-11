import React from "react";
import { ResponsiveContainer, FunnelChart, Funnel, LabelList, Tooltip } from "recharts";
import { type VisualRendererProps, getMetricFriendlyLabel } from "./renderer-types";

export function FunnelRenderer({
  data,
  palette,
  fieldLabelsMap,
}: VisualRendererProps) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics;
  const metricKey = metrics[0] || "";

  const funnelData = rows.map((r, i) => ({
    name: String(r[axisKey] ?? `Etapa ${i + 1}`),
    value: Number(r[metricKey]) || 0,
    fill: palette[i % palette.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <Tooltip
          formatter={(val: any) => [
            Number(val).toLocaleString("es-PE"),
            getMetricFriendlyLabel(metricKey, fieldLabelsMap),
          ]}
        />
        <Funnel dataKey="value" data={funnelData} isAnimationActive={false}>
          <LabelList position="right" fill="#475569" stroke="none" dataKey="name" fontSize={11} />
          <LabelList position="center" fill="#ffffff" stroke="none" dataKey="value" fontSize={11} fontWeight="bold" />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}
