import type { ComponentType } from "react";
import type { VisualType } from "@/lib/dashboards/widget-schema";
import type { VisualRendererProps } from "./renderer-types";

import { CardRenderer } from "./CardRenderer";
import { KpiTrendRenderer } from "./KpiTrendRenderer";
import { MultiCardRenderer } from "./MultiCardRenderer";
import { GaugeRenderer } from "./GaugeRenderer";
import { TableRenderer } from "./TableRenderer";
import { MatrixRenderer } from "./MatrixRenderer";
import { HeatmapRenderer } from "./HeatmapRenderer";
import { PieDonutRenderer } from "./PieDonutRenderer";
import { FunnelRenderer } from "./FunnelRenderer";
import { TreemapRenderer } from "./TreemapRenderer";
import { RadarRenderer } from "./RadarRenderer";
import { BarColumnRenderer } from "./BarColumnRenderer";
import { LineAreaRenderer } from "./LineAreaRenderer";
import { ComboRenderer } from "./ComboRenderer";
import { ScatterRenderer } from "./ScatterRenderer";
import { WaterfallRenderer } from "./WaterfallRenderer";
import { ParetoRenderer } from "./ParetoRenderer";

export * from "./renderer-types";
export * from "./CardRenderer";
export * from "./KpiTrendRenderer";
export * from "./MultiCardRenderer";
export * from "./GaugeRenderer";
export * from "./TableRenderer";
export * from "./MatrixRenderer";
export * from "./HeatmapRenderer";
export * from "./PieDonutRenderer";
export * from "./FunnelRenderer";
export * from "./TreemapRenderer";
export * from "./RadarRenderer";
export * from "./BarColumnRenderer";
export * from "./LineAreaRenderer";
export * from "./ComboRenderer";
export * from "./ScatterRenderer";
export * from "./WaterfallRenderer";
export * from "./ParetoRenderer";

/**
 * Mapa centralizado de renderers indexado por VisualType.
 * Única fuente de verdad de renderizado dinámico para la cuadrícula y dashboards.
 */
export const VISUAL_RENDERERS: Record<Exclude<VisualType, "slicer">, ComponentType<VisualRendererProps>> = {
  // Barras y Columnas
  column: BarColumnRenderer,
  stackedColumn: BarColumnRenderer,
  percentColumn: BarColumnRenderer,
  bar: BarColumnRenderer,
  stackedBar: BarColumnRenderer,
  percentBar: BarColumnRenderer,
  waterfall: WaterfallRenderer,
  pareto: ParetoRenderer,

  // Líneas y Áreas
  line: LineAreaRenderer,
  area: LineAreaRenderer,
  stackedArea: LineAreaRenderer,
  combo: ComboRenderer,

  // Circulares
  pie: PieDonutRenderer,
  donut: PieDonutRenderer,

  // Tarjetas y KPIs
  card: CardRenderer,
  kpiTrend: KpiTrendRenderer,
  multiCard: MultiCardRenderer,
  gauge: GaugeRenderer,

  // Tablas y Matrices
  table: TableRenderer,
  matrix: MatrixRenderer,

  // Avanzados
  scatter: ScatterRenderer,
  heatmap: HeatmapRenderer,
  radar: RadarRenderer,
  funnel: FunnelRenderer,
  treemap: TreemapRenderer,
};
