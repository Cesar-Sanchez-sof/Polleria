"use client";

import React, { useMemo } from "react";
import { DynamicVisual } from "./visuals/DynamicVisual";
import { adaptLegacyWidget } from "@/lib/dashboards/legacy-adapter";
import type { WidgetConfig } from "@/lib/dashboards/widget-schema";

export interface WidgetData {
  id: string;
  title: string;
  type: string;
  metricKey: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: unknown;
}

interface WidgetRendererProps {
  widget: WidgetData;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditMode?: boolean;
  isShareMode?: boolean;
}

export function WidgetRenderer({
  widget,
  isSelected,
  onSelect,
  isEditMode,
  isShareMode,
}: WidgetRendererProps) {
  // Convierte widgets antiguos o incompletos en un WidgetConfig válido estilo Power BI
  const validConfig: WidgetConfig = useMemo(() => {
    return adaptLegacyWidget(widget);
  }, [widget]);

  return (
    <DynamicVisual
      config={validConfig}
      widgetId={widget.id}
      isSelected={isSelected}
      onSelect={onSelect}
      isEditMode={isEditMode}
      isShareMode={isShareMode}
    />
  );
}
