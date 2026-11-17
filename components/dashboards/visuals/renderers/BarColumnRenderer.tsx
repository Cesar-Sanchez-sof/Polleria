import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
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
  calculateBarCategoryGap,
  calculateYAxisDomain,
  evaluateConditionalColor,
} from "@/lib/dashboards/format-utils";

export function BarColumnRenderer({
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

  const isBar = visualType === "bar" || visualType === "stackedBar" || visualType === "percentBar";
  const isStacked = visualType === "stackedBar" || visualType === "stackedColumn";
  const isPercent = visualType === "percentBar" || visualType === "percentColumn";

  const barWidth = format.chartSpecific?.bar?.barWidth ?? 70;
  const borderRadius = format.chartSpecific?.bar?.borderRadius ?? 0;
  const barCategoryGap = calculateBarCategoryGap(barWidth);

  const rot = typeof format.axes?.labelRotation === "number" ? format.axes.labelRotation : 0;
  const textAnchor = rot > 0 ? "start" : rot < 0 ? "end" : "middle";
  const xAxisHeight = rot !== 0 ? 55 : 30;

  const showGridX = Boolean(format.axes?.showGridX);
  const showGridY = format.axes?.showGridY ?? format.axes?.showGrid ?? true;

  const numDomain = isPercent
    ? ([0, 1] as [number, number])
    : calculateYAxisDomain(format.axes?.yAxisMin, format.axes?.yAxisMax);

  const refLine = format.referenceLine;
  const hasRefLine = refLine?.show && !isPercent;

  const hasConditionalColors = Boolean(
    format.conditionalColors && format.conditionalColors.length > 0 && !isStacked && !isPercent
  );

  const dataLabelsShow = format.dataLabels?.show;
  const dataLabelPos = (format.dataLabels?.position as "top" | "center" | "bottom" | "outside") || (isBar ? "right" : "top");
  const dataLabelColor = format.dataLabels?.color || "#64748b";
  const dataLabelFontSize = format.dataLabels?.fontSize || 11;

  const handleBarClick = (entry: Record<string, unknown>) => {
    if (!onCrossFilter) return;
    const field = axisKey;
    const rawVal = entry.rawValue !== undefined && entry.rawValue !== null ? entry.rawValue : entry[field];
    const displayVal = String(entry[field] ?? rawVal);
    onCrossFilter(field, rawVal, displayVal);
  };

  if (isBar) {
    const barRadius: [number, number, number, number] =
      isStacked || isPercent ? [0, 0, 0, 0] : [0, borderRadius, borderRadius, 0];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          barCategoryGap={barCategoryGap}
          stackOffset={isPercent ? "expand" : undefined}
          margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
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
            type="number"
            domain={numDomain}
            tick={{ fontSize: 11 }}
            tickFormatter={isPercent ? (v) => `${Math.round(v * 100)}%` : undefined}
          />
          <YAxis
            dataKey={axisKey}
            type="category"
            tick={{ fontSize: 11 }}
            width={85}
          />
          <Tooltip
            formatter={(val: unknown, name: unknown) => [
              isPercent
                ? `${(Number(val) * 100).toFixed(1)}%`
                : Number(val).toLocaleString("es-PE"),
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
              x={refLine.value}
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
            <Bar
              key={m}
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              fill={palette[idx % palette.length]}
              stackId={isStacked || isPercent ? "stackA" : undefined}
              radius={barRadius}
              isAnimationActive={false}
              onClick={(entry) => handleBarClick(entry as unknown as Record<string, unknown>)}
              style={{ cursor: onCrossFilter ? "pointer" : "default" }}
            >
              {hasConditionalColors &&
                rows.map((row, rIdx) => {
                  const val = Number(row[m]);
                  const evaluated = evaluateConditionalColor(
                    val,
                    format.conditionalColors,
                    palette[idx % palette.length]
                  );
                  return <Cell key={`bar-cell-${rIdx}`} fill={evaluated} />;
                })}
              {dataLabelsShow && (
                <LabelList
                  dataKey={m}
                  position={dataLabelPos}
                  fill={dataLabelColor}
                  fontSize={dataLabelFontSize}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Columnas verticales (column, stackedColumn, percentColumn)
  const colRadius: [number, number, number, number] =
    isStacked || isPercent ? [0, 0, 0, 0] : [borderRadius, borderRadius, 0, 0];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        barCategoryGap={barCategoryGap}
        stackOffset={isPercent ? "expand" : undefined}
        margin={{ top: 10, right: 10, left: 10, bottom: xAxisHeight }}
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
          domain={numDomain}
          tick={{ fontSize: 11 }}
          tickFormatter={isPercent ? (v) => `${Math.round(v * 100)}%` : undefined}
        />
        <Tooltip
          formatter={(val: unknown, name: unknown) => [
            isPercent
              ? `${(Number(val) * 100).toFixed(1)}%`
              : Number(val).toLocaleString("es-PE"),
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
          <Bar
            key={m}
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            fill={palette[idx % palette.length]}
            stackId={isStacked || isPercent ? "stackA" : undefined}
            radius={colRadius}
            isAnimationActive={false}
            onClick={(entry) => handleBarClick(entry as unknown as Record<string, unknown>)}
            style={{ cursor: onCrossFilter ? "pointer" : "default" }}
          >
            {hasConditionalColors &&
              rows.map((row, rIdx) => {
                const val = Number(row[m]);
                const evaluated = evaluateConditionalColor(
                  val,
                  format.conditionalColors,
                  palette[idx % palette.length]
                );
                return <Cell key={`col-cell-${rIdx}`} fill={evaluated} />;
              })}
            {dataLabelsShow && (
              <LabelList
                dataKey={m}
                position={dataLabelPos}
                fill={dataLabelColor}
                fontSize={dataLabelFontSize}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
