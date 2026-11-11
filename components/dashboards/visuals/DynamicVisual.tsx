"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  PieChart as PieIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useVisualData, useDashboardCatalog } from "@/lib/hooks/use-visual-data";
import type { WidgetConfig } from "@/lib/dashboards/widget-schema";

interface DynamicVisualProps {
  config: WidgetConfig;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditMode?: boolean;
}

function getLegendProps(pos?: "top" | "bottom" | "left" | "right") {
  switch (pos) {
    case "bottom":
      return { verticalAlign: "bottom" as const, align: "center" as const, layout: "horizontal" as const };
    case "left":
      return { verticalAlign: "middle" as const, align: "left" as const, layout: "vertical" as const };
    case "right":
      return { verticalAlign: "middle" as const, align: "right" as const, layout: "vertical" as const };
    case "top":
    default:
      return { verticalAlign: "top" as const, align: "center" as const, layout: "horizontal" as const };
  }
}

function getMetricFriendlyLabel(metricKey: string, fieldLabelsMap: Map<string, string>): string {
  if (fieldLabelsMap.has(metricKey)) {
    return fieldLabelsMap.get(metricKey)!;
  }
  const stripped = metricKey.replace(/_(sum|avg|count|min|max|countDistinct)$/, "");
  if (fieldLabelsMap.has(stripped)) {
    return fieldLabelsMap.get(stripped)!;
  }
  return metricKey;
}

export function DynamicVisual({
  config,
  isSelected,
  onSelect,
  isEditMode,
}: DynamicVisualProps) {
  const { data, isLoading, error, isTruncated } = useVisualData(config.data);
  const { catalog } = useDashboardCatalog();

  const format = config.format;
  const visualType = config.visualType;
  const isUnconfigured = !config.data.dataset;

  const isPieOrDonut = visualType === "pie" || visualType === "donut";
  const hasNoCategory = isPieOrDonut && !config.data.axis;
  const hasNoValues = !config.data.values || config.data.values.length === 0;

  let incompleteMessage: string | null = null;
  if (!isUnconfigured) {
    if (hasNoCategory) {
      incompleteMessage = "Falta asignar: Categoría";
    } else if (hasNoValues) {
      incompleteMessage = "Falta asignar: Valores";
    }
  }

  const fieldLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (catalog) {
      for (const ds of catalog) {
        for (const f of ds.fields) {
          map.set(f.id, f.label);
        }
      }
    }
    return map;
  }, [catalog]);

  // Paleta de colores
  const palette =
    format.colors.custom && format.colors.custom.length > 0
      ? format.colors.custom
      : format.colors.series || ["#d97706", "#2563eb", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"];

  // Estilos del contenedor según config.format
  const containerStyle: React.CSSProperties = {
    backgroundColor: format.background?.color || "transparent",
    borderRadius: format.border?.radius ?? 12,
    borderWidth: format.border?.show ? (format.border?.width ?? 1) : 0,
    borderColor: format.border?.show
      ? format.border?.color || "var(--border)"
      : "transparent",
    borderStyle: format.border?.show ? "solid" : "none",
  };

  // Click handler para selección en modo edición
  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode && onSelect) {
      e.stopPropagation();
      onSelect();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={containerStyle}
      className={`relative flex flex-col w-full h-full p-4 overflow-hidden select-none transition-all ${
        isEditMode ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "ring-2 ring-primary ring-offset-2 shadow-md"
          : "hover:shadow-xs"
      }`}
    >
      {/* 1. Cabecera del Visual: Título e Insignia de Truncado */}
      <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
        {format.title.show ? (
          <h4
            style={{
              fontSize: format.title.fontSize || 14,
              color: format.title.color || "inherit",
              textAlign: (format.title.align as React.CSSProperties["textAlign"]) || "left",
            }}
            className="font-semibold tracking-tight truncate flex-1"
          >
            {format.title.text || "Visual"}
          </h4>
        ) : (
          <div />
        )}

        {isTruncated && (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 gap-1 shrink-0"
            title="Se aplicó el límite de filas seguro para proteger el rendimiento"
          >
            <AlertTriangle className="size-3" />
            <span>Datos truncados</span>
          </Badge>
        )}
      </div>

      {/* 2. Cuerpo del Visual según estado */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">
        {/* ESTADO A: No configurado */}
        {isUnconfigured && (
          <div className="flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/80 rounded-lg w-full h-full bg-muted/20">
            <PieIcon className="size-8 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-medium text-foreground">Visual sin configurar</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Selecciona un tipo de visual y asigna campos
            </p>
          </div>
        )}

        {/* ESTADO B: Visual incompleto (Falta asignar Categoría o Valores) */}
        {!isUnconfigured && incompleteMessage && (
          <div className="flex flex-col items-center justify-center text-center p-4 border border-dashed border-amber-300 rounded-lg w-full h-full bg-amber-500/5">
            <AlertCircle className="size-6 text-amber-500 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{incompleteMessage}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Asigna los campos requeridos en el panel de propiedades
            </p>
          </div>
        )}

        {/* ESTADO C: Cargando */}
        {!isUnconfigured && !incompleteMessage && isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Cargando datos...</span>
          </div>
        )}

        {/* ESTADO D: Error */}
        {!isUnconfigured && !incompleteMessage && !isLoading && error && (
          <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 w-full max-w-sm">
            <AlertCircle className="size-5 mb-1 shrink-0" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        {/* ESTADO E: Sin datos */}
        {!isUnconfigured && !incompleteMessage && !isLoading && !error && (!data || data.rows.length === 0) && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <p className="text-xs font-medium">Sin datos para mostrar con los filtros aplicados</p>
          </div>
        )}

        {/* ESTADO F: Renderizado de Datos Exitoso */}
        {!isUnconfigured && !incompleteMessage && !isLoading && !error && data && data.rows.length > 0 && (
          <VisualContent
            visualType={visualType}
            data={data}
            format={format}
            palette={palette}
            fieldLabelsMap={fieldLabelsMap}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Contenido específico por visualType (recharts y shadcn)
 */
function VisualContent({
  visualType,
  data,
  format,
  palette,
  fieldLabelsMap,
}: {
  visualType: string;
  data: {
    rows: Record<string, string | number | boolean | null>[];
    meta: {
      axis?: string;
      legend?: string;
      metrics: string[];
    };
  };
  format: WidgetConfig["format"];
  palette: string[];
  fieldLabelsMap: Map<string, string>;
}) {
  const rows = data.rows;
  const axisKey = data.meta.axis || "axis";
  const metrics = data.meta.metrics.length > 0 ? data.meta.metrics : Object.keys(rows[0] || {}).filter((k) => k !== axisKey);
  const legProps = getLegendProps(format.legend?.position);

  // 1. KPI CARD
  if (visualType === "card") {
    const firstRow = rows[0] || {};
    const metricVal = metrics.length > 0 ? firstRow[metrics[0]] : 0;
    const num = Number(metricVal) || 0;

    const decimals = format.numberFormat?.decimals ?? 2;
    const prefix = format.numberFormat?.prefix ?? "S/ ";
    const compact = format.numberFormat?.compact ?? false;

    let displayStr: string;
    if (compact) {
      if (Math.abs(num) >= 1_000_000) {
        displayStr = `${(num / 1_000_000).toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}M`;
      } else if (Math.abs(num) >= 1_000) {
        displayStr = `${(num / 1_000).toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}K`;
      } else {
        displayStr = num.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
    } else {
      displayStr = num.toLocaleString("es-PE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="text-3xl font-extrabold tracking-tight text-foreground flex items-baseline gap-1">
          {prefix && <span className="text-xl font-semibold text-muted-foreground">{prefix}</span>}
          <span>{displayStr}</span>
        </div>
        {format.axes?.yTitle && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">{format.axes.yTitle}</p>
        )}
      </div>
    );
  }

  // 2. TABLA
  if (visualType === "table") {
    const headers = [
      ...(data.meta.axis ? [data.meta.axis] : []),
      ...(data.meta.legend ? [data.meta.legend] : []),
      ...metrics,
    ];

    return (
      <div className="w-full h-full overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/30 sticky top-0">
              {headers.map((h) => (
                <th key={h} className="text-left font-semibold py-2 px-3 text-muted-foreground uppercase text-[10px]">
                  {getMetricFriendlyLabel(h, fieldLabelsMap)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                {headers.map((h) => {
                  const val = r[h];
                  const isNumber = typeof val === "number";
                  return (
                    <td key={h} className={`py-1.5 px-3 ${isNumber ? "font-mono" : ""}`}>
                      {isNumber ? (val as number).toLocaleString("es-PE") : String(val ?? "-")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 3. PIE / DONUT
  if (visualType === "pie" || visualType === "donut") {
    const primaryMetric = metrics[0];
    const isDonut = visualType === "donut";

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey={primaryMetric}
            nameKey={axisKey}
            cx="50%"
            cy="50%"
            innerRadius={isDonut ? "55%" : 0}
            outerRadius="80%"
            paddingAngle={2}
          >
            {rows.map((_, index) => (
              <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
          {format.legend?.show && (
            <Legend
              verticalAlign={legProps.verticalAlign}
              align={legProps.align}
              layout={legProps.layout}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // 4. BARRAS HORIZONTALES (bar)
  if (visualType === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          {format.axes?.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis type="number" />
          <YAxis dataKey={axisKey} type="category" width={90} tick={{ fontSize: 11 }} />
          <Tooltip />
          {format.legend?.show && metrics.length > 1 && (
            <Legend verticalAlign={legProps.verticalAlign} align={legProps.align} layout={legProps.layout} />
          )}
          {metrics.map((m, idx) => (
            <Bar
              key={m}
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              fill={palette[idx % palette.length]}
              radius={[0, 4, 4, 0]}
            >
              {format.dataLabels?.show && (
                <LabelList dataKey={m} position={format.dataLabels.position === "inside" ? "inside" : "right"} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // 5. LÍNEAS (line)
  if (visualType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {format.axes?.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {format.legend?.show && (
            <Legend verticalAlign={legProps.verticalAlign} align={legProps.align} layout={legProps.layout} />
          )}
          {metrics.map((m, idx) => (
            <Line
              key={m}
              type="monotone"
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              stroke={palette[idx % palette.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // 6. ÁREA (area)
  if (visualType === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {format.axes?.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {format.legend?.show && (
            <Legend verticalAlign={legProps.verticalAlign} align={legProps.align} layout={legProps.layout} />
          )}
          {metrics.map((m, idx) => (
            <Area
              key={m}
              type="monotone"
              dataKey={m}
              name={getMetricFriendlyLabel(m, fieldLabelsMap)}
              stroke={palette[idx % palette.length]}
              fill={palette[idx % palette.length]}
              fillOpacity={0.25}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // 7. COLUMNAS VERTICALES (column - defecto)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        {format.axes?.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey={axisKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {format.legend?.show && metrics.length > 1 && (
          <Legend verticalAlign={legProps.verticalAlign} align={legProps.align} layout={legProps.layout} />
        )}
        {metrics.map((m, idx) => (
          <Bar
            key={m}
            dataKey={m}
            name={getMetricFriendlyLabel(m, fieldLabelsMap)}
            fill={palette[idx % palette.length]}
            radius={[4, 4, 0, 0]}
          >
            {format.dataLabels?.show && (
              <LabelList dataKey={m} position={format.dataLabels.position === "inside" ? "inside" : "top"} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
