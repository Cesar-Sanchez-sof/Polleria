import type { ComponentType } from "react";
import type { VisualType, WidgetConfig } from "@/lib/dashboards/widget-schema";

export interface VisualRendererProps {
  visualType: VisualType;
  config: WidgetConfig;
  data: {
    rows: Record<string, string | number | boolean | null>[];
    meta: {
      axis?: string;
      legend?: string;
      metrics: string[];
    };
  };
  previousData?: {
    rows: Record<string, string | number | boolean | null>[];
    meta: {
      axis?: string;
      legend?: string;
      metrics: string[];
    };
  } | null;
  format: WidgetConfig["format"];
  palette: string[];
  fieldLabelsMap: Map<string, string>;
}

export function getLegendProps(pos?: "top" | "bottom" | "left" | "right") {
  switch (pos) {
    case "bottom":
      return { verticalAlign: "bottom" as const, align: "center" as const };
    case "left":
      return { verticalAlign: "middle" as const, align: "left" as const, layout: "vertical" as const };
    case "right":
      return { verticalAlign: "middle" as const, align: "right" as const, layout: "vertical" as const };
    case "top":
    default:
      return { verticalAlign: "top" as const, align: "center" as const };
  }
}

export function getMetricFriendlyLabel(metricKey: string, fieldLabelsMap: Map<string, string>): string {
  if (fieldLabelsMap.has(metricKey)) {
    return fieldLabelsMap.get(metricKey)!;
  }
  const cleanKey = metricKey.replace(/_(sum|avg|count|min|max)$/, "");
  if (fieldLabelsMap.has(cleanKey)) {
    return fieldLabelsMap.get(cleanKey)!;
  }
  return metricKey;
}
