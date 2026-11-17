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
  ReferenceLine,
} from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";
import { calculateYAxisDomain } from "@/lib/dashboards/format-utils";

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

  const rot = typeof format.axes?.labelRotation === "number" ? format.axes.labelRotation : 0;
  const textAnchor = rot > 0 ? "start" : rot < 0 ? "end" : "middle";
  const xAxisHeight = rot !== 0 ? 55 : 30;

  const showGridX = Boolean(format.axes?.showGridX);
  const showGridY = format.axes?.showGridY ?? format.axes?.showGrid ?? true;
  const yDomain = calculateYAxisDomain(format.axes?.yAxisMin, format.axes?.yAxisMax);

  const refLine = format.referenceLine;
  const hasRefLine = Boolean(refLine?.show);

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

  if (columnMetrics.length === 0 && lineMetrics.length === 0) {
    if (metrics.length > 0) columnMetrics.push(metrics[0]);
    if (metrics.length > 1) lineMetrics.push(...metrics.slice(1));
  }

  const showSecondaryY = format.axes?.showSecondaryY && lineMetrics.length > 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={rows}
        margin={{ top: 10, right: showSecondaryY ? 30 : 10, left: 10, bottom: xAxisHeight }}
      >
        {(showGridX || showGridY) && (
          <CartesianGrid
            horizontal={showGridY}
            vertical={showGridX}
            strokeDasharray="3 3"
            opacity={0.3}
          />
        )}
        <XAxis
          dataKey={axisKey}
          tick={{ fontSize: 11 }}
          angle={rot}
          textAnchor={textAnchor}
          height={xAxisHeight}
          interval={0}
        />
        <YAxis
          yAxisId="left"
          domain={yDomain}
          tick={{ fontSize: 11 }}
          label={
            format.axes?.yTitle
              ? { value: format.axes.yTitle, angle: -90, position: "insideLeft", fontSize: 10 }
              : undefined
          }
        />
        {showSecondaryY && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            label={
              format.axes?.secondaryYTitle
                ? {
                    value: format.axes.secondaryYTitle,
                    angle: 90,
                    position: "insideRight",
                    fontSize: 10,
                  }
                : undefined
            }
          />
        )}
        <Tooltip
          formatter={(val: unknown, name: unknown) => [
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
        {hasRefLine && (
          <ReferenceLine
            yAxisId="left"
            y={refLine.value}
            stroke={refLine.color}
            strokeDasharray="4 4"
            label={{
              value: refLine.label,
              fill: refLine.color,
              fontSize: 10,
              position: "insideTopRight",
            }}
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
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
