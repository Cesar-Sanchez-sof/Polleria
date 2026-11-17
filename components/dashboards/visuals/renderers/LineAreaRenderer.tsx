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
  ReferenceLine,
  LabelList,
} from "recharts";
import { type VisualRendererProps, getLegendProps, getMetricFriendlyLabel } from "./renderer-types";
import {
  calculateFillOpacity,
  calculateYAxisDomain,
} from "@/lib/dashboards/format-utils";

export function LineAreaRenderer({
  visualType,
  data,
  format,
  palette,
  fieldLabelsMap,
  onCrossFilter,
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

  const strokeWidth = format.chartSpecific?.lineArea?.strokeWidth ?? 2;
  const curveType = format.chartSpecific?.lineArea?.curveType ?? "monotone";
  const showDots = format.chartSpecific?.lineArea?.showDots !== false;
  const fillOpacity = calculateFillOpacity(format.chartSpecific?.lineArea?.fillOpacity ?? 20);

  const refLine = format.referenceLine;
  const hasRefLine = Boolean(refLine?.show);

  const dataLabelsShow = format.dataLabels?.show;
  const dataLabelPos = (format.dataLabels?.position as "top" | "bottom") || "top";
  const dataLabelColor = format.dataLabels?.color || "#64748b";
  const dataLabelFontSize = format.dataLabels?.fontSize || 11;

  const handleDotClick = (entry: Record<string, unknown>) => {
    if (!onCrossFilter) return;
    const rawVal = entry.rawValue !== undefined && entry.rawValue !== null ? entry.rawValue : entry[axisKey];
    const displayVal = String(entry[axisKey] ?? rawVal);
    onCrossFilter(axisKey, rawVal, displayVal);
  };

  if (visualType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: xAxisHeight }}>
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
          <YAxis domain={yDomain} tick={{ fontSize: 11 }} />
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
          {metrics.map((m, idx) => (
            <Line
              key={m}
              type={curveType}
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              stroke={palette[idx % palette.length]}
              strokeWidth={strokeWidth}
              dot={showDots ? { r: 3, style: { cursor: onCrossFilter ? "pointer" : "default" } } : false}
              activeDot={{ r: 5, onClick: (_: unknown, payload: unknown) => handleDotClick((payload as { payload: Record<string, unknown> }).payload) }}
              isAnimationActive={false}
            >
              {dataLabelsShow && (
                <LabelList
                  dataKey={m}
                  position={dataLabelPos}
                  fill={dataLabelColor}
                  fontSize={dataLabelFontSize}
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Area o stackedArea
  const isStacked = visualType === "stackedArea";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: xAxisHeight }}>
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
        <YAxis domain={yDomain} tick={{ fontSize: 11 }} />
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
        {metrics.map((m, idx) => (
          <Area
            key={m}
            type={curveType}
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            stroke={palette[idx % palette.length]}
            strokeWidth={strokeWidth}
            fill={palette[idx % palette.length]}
            fillOpacity={fillOpacity}
            stackId={isStacked ? "stackArea" : undefined}
            isAnimationActive={false}
          >
            {dataLabelsShow && (
              <LabelList
                dataKey={m}
                position={isStacked ? "center" : dataLabelPos}
                fill={dataLabelColor}
                fontSize={dataLabelFontSize}
              />
            )}
          </Area>
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
