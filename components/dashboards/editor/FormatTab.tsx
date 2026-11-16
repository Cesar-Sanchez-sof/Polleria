"use client";

import React, { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_PALETTES, type ConditionalColorRule } from "@/lib/dashboards/widget-schema";
import { getVisualRegistryEntry } from "@/lib/dashboards/visual-registry";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";

export function FormatTab({ widgetId }: { widgetId: string }) {
  const { widgets, updateWidgetFormat, updateWidgetTitle } = useDashboardEditorStore();
  const selectedWidget = widgets.find((w) => w.id === widgetId);
  if (!selectedWidget) return null;

  const { config } = selectedWidget;
  const formatConfig = config.format;
  const registryEntry = getVisualRegistryEntry(config.visualType);
  const options = registryEntry.format;
  const caps = registryEntry.formatCaps;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-24 m-0">
      <Accordion
        multiple
        defaultValue={[
          "title",
          "colors",
          "chartSpecific",
          "labels",
          "legend",
          "axes",
          "referenceLine",
          "conditionalColors",
          "numberFormat",
          "border",
        ]}
        className="space-y-2"
      >
        {/* SECCIÓN 1: TÍTULO */}
        <AccordionItem value="title" className="border border-border/80 rounded-lg bg-card/60 px-3">
          <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
            Título
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar título</Label>
              <Switch
                checked={formatConfig.title.show}
                onCheckedChange={(checked) =>
                  updateWidgetFormat(widgetId, {
                    title: { ...formatConfig.title, show: checked },
                  })
                }
              />
            </div>

            {formatConfig.title.show && (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Texto del título</Label>
                  <Input
                    value={formatConfig.title.text}
                    onChange={(e) => updateWidgetTitle(widgetId, e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Tamaño fuente</Label>
                    <Input
                      type="number"
                      min={10}
                      max={28}
                      value={formatConfig.title.fontSize || 14}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          title: { ...formatConfig.title, fontSize: Number(e.target.value) },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Alineación</Label>
                    <select
                      value={formatConfig.title.align || "left"}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          title: {
                            ...formatConfig.title,
                            align: e.target.value as "left" | "center" | "right",
                          },
                        })
                      }
                      className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECCIÓN 2: PALETA DE COLORES */}
        <AccordionItem value="colors" className="border border-border/80 rounded-lg bg-card/60 px-3">
          <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
            Colores y Paleta
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Paleta predefinida</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(DEFAULT_PALETTES).map((pKey) => {
                  const pal = DEFAULT_PALETTES[pKey];
                  const isSelected = formatConfig.colors?.palette === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() =>
                        updateWidgetFormat(widgetId, {
                          colors: {
                            palette: pKey,
                            series: pal,
                          },
                        })
                      }
                      className={`p-2 rounded-lg border text-left flex flex-col gap-1.5 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <span className="text-[10px] font-semibold capitalize">{pKey}</span>
                      <div className="flex items-center gap-1">
                        {pal.slice(0, 5).map((c, i) => (
                          <div
                            key={i}
                            className="size-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <ColorPickerPopover
              currentColor={formatConfig.colors?.series?.[0] || "#ef4444"}
              onColorChange={(newColor) => {
                const currentSeries = [...(formatConfig.colors?.series || DEFAULT_PALETTES.polleria)];
                currentSeries[0] = newColor;
                updateWidgetFormat(widgetId, {
                  colors: {
                    palette: "custom",
                    series: currentSeries,
                  },
                });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        {/* SECCIÓN 3: CONFIGURACIÓN ESPECÍFICA DE GRÁFICO (formatCaps.chartSpecific) */}
        {caps.chartSpecific === "bar" && (
          <AccordionItem value="chartSpecific" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Formato de Barras
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Ancho de Barra (%)</Label>
                  <span className="text-[10px] font-mono font-medium">
                    {formatConfig.chartSpecific?.bar?.barWidth ?? 70}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={formatConfig.chartSpecific?.bar?.barWidth ?? 70}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      chartSpecific: {
                        ...formatConfig.chartSpecific,
                        bar: {
                          borderRadius: formatConfig.chartSpecific?.bar?.borderRadius ?? 0,
                          barWidth: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Radio de Esquinas (px)</Label>
                  <span className="text-[10px] font-mono font-medium">
                    {formatConfig.chartSpecific?.bar?.borderRadius ?? 0} px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={formatConfig.chartSpecific?.bar?.borderRadius ?? 0}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      chartSpecific: {
                        ...formatConfig.chartSpecific,
                        bar: {
                          barWidth: formatConfig.chartSpecific?.bar?.barWidth ?? 70,
                          borderRadius: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {caps.chartSpecific === "lineArea" && (
          <AccordionItem value="chartSpecific" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Formato de Línea y Área
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Grosor de Trazo (px)</Label>
                  <span className="text-[10px] font-mono font-medium">
                    {formatConfig.chartSpecific?.lineArea?.strokeWidth ?? 2} px
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={formatConfig.chartSpecific?.lineArea?.strokeWidth ?? 2}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      chartSpecific: {
                        ...formatConfig.chartSpecific,
                        lineArea: {
                          strokeWidth: Number(e.target.value),
                          curveType: formatConfig.chartSpecific?.lineArea?.curveType ?? "monotone",
                          showDots: formatConfig.chartSpecific?.lineArea?.showDots ?? true,
                          fillOpacity: formatConfig.chartSpecific?.lineArea?.fillOpacity ?? 20,
                        },
                      },
                    })
                  }
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Curvatura</Label>
                  <select
                    value={formatConfig.chartSpecific?.lineArea?.curveType ?? "monotone"}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        chartSpecific: {
                          ...formatConfig.chartSpecific,
                          lineArea: {
                            strokeWidth: formatConfig.chartSpecific?.lineArea?.strokeWidth ?? 2,
                            curveType: e.target.value as "monotone" | "linear",
                            showDots: formatConfig.chartSpecific?.lineArea?.showDots ?? true,
                            fillOpacity: formatConfig.chartSpecific?.lineArea?.fillOpacity ?? 20,
                          },
                        },
                      })
                    }
                    className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="monotone">Suave (Monotone)</option>
                    <option value="linear">Recta (Linear)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Puntos clave</Label>
                  <div className="flex items-center justify-between h-7">
                    <span className="text-xs text-muted-foreground">Puntos</span>
                    <Switch
                      checked={formatConfig.chartSpecific?.lineArea?.showDots ?? true}
                      onCheckedChange={(checked) =>
                        updateWidgetFormat(widgetId, {
                          chartSpecific: {
                            ...formatConfig.chartSpecific,
                            lineArea: {
                              strokeWidth: formatConfig.chartSpecific?.lineArea?.strokeWidth ?? 2,
                              curveType: formatConfig.chartSpecific?.lineArea?.curveType ?? "monotone",
                              showDots: checked,
                              fillOpacity: formatConfig.chartSpecific?.lineArea?.fillOpacity ?? 20,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Opacidad de Relleno (%)</Label>
                  <span className="text-[10px] font-mono font-medium">
                    {formatConfig.chartSpecific?.lineArea?.fillOpacity ?? 20}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formatConfig.chartSpecific?.lineArea?.fillOpacity ?? 20}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      chartSpecific: {
                        ...formatConfig.chartSpecific,
                        lineArea: {
                          strokeWidth: formatConfig.chartSpecific?.lineArea?.strokeWidth ?? 2,
                          curveType: formatConfig.chartSpecific?.lineArea?.curveType ?? "monotone",
                          showDots: formatConfig.chartSpecific?.lineArea?.showDots ?? true,
                          fillOpacity: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {caps.chartSpecific === "donut" && (
          <AccordionItem value="chartSpecific" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Formato de Anillo
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Radio Interno (%)</Label>
                  <span className="text-[10px] font-mono font-medium">
                    {formatConfig.chartSpecific?.donut?.innerRadius ?? 60}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={formatConfig.chartSpecific?.donut?.innerRadius ?? 60}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      chartSpecific: {
                        ...formatConfig.chartSpecific,
                        donut: {
                          innerRadius: Number(e.target.value),
                          startAngle: formatConfig.chartSpecific?.donut?.startAngle ?? 90,
                        },
                      },
                    })
                  }
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Ángulo Inicial (°)</Label>
                <Input
                  type="number"
                  value={formatConfig.chartSpecific?.donut?.startAngle ?? 90}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      chartSpecific: {
                        ...formatConfig.chartSpecific,
                        donut: {
                          innerRadius: formatConfig.chartSpecific?.donut?.innerRadius ?? 60,
                          startAngle: Number(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className="h-7 text-xs"
                />
                <span className="text-[10px] text-muted-foreground">
                  Ajusta automáticamente el ángulo final a 360° desde el inicio.
                </span>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 4: ETIQUETAS DE DATOS */}
        {options.dataLabels && caps.dataLabelPositions.length > 0 && (
          <AccordionItem value="labels" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Etiquetas de Datos
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mostrar etiquetas</Label>
                <Switch
                  checked={formatConfig.dataLabels?.show ?? false}
                  onCheckedChange={(checked) =>
                    updateWidgetFormat(widgetId, {
                      dataLabels: { ...formatConfig.dataLabels, show: checked },
                    })
                  }
                />
              </div>

              {formatConfig.dataLabels?.show && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Posición</Label>
                    <select
                      value={formatConfig.dataLabels?.position || caps.dataLabelPositions[0]}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          dataLabels: { ...formatConfig.dataLabels, position: e.target.value },
                        })
                      }
                      className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      {caps.dataLabelPositions.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos === "top"
                            ? "Arriba (Top)"
                            : pos === "center"
                            ? "Centro (Center)"
                            : pos === "bottom"
                            ? "Abajo (Bottom)"
                            : "Fuera (Outside)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Tamaño fuente</Label>
                    <Input
                      type="number"
                      min={9}
                      max={18}
                      value={formatConfig.dataLabels?.fontSize || 11}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          dataLabels: { ...formatConfig.dataLabels, fontSize: Number(e.target.value) },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 5: LEYENDA */}
        {options.legend && (
          <AccordionItem value="legend" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Leyenda
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mostrar leyenda</Label>
                <Switch
                  checked={formatConfig.legend.show}
                  onCheckedChange={(checked) =>
                    updateWidgetFormat(widgetId, {
                      legend: { ...formatConfig.legend, show: checked },
                    })
                  }
                />
              </div>

              {formatConfig.legend.show && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Posición</Label>
                  <select
                    value={formatConfig.legend.position || "top"}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        legend: {
                          ...formatConfig.legend,
                          position: e.target.value as "top" | "bottom" | "left" | "right",
                        },
                      })
                    }
                    className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="top">Arriba</option>
                    <option value="bottom">Abajo</option>
                    <option value="left">Izquierda</option>
                    <option value="right">Derecha</option>
                  </select>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 6: EJES Y ESCALA (formatCaps) */}
        {(options.axes || caps.yAxisRange || caps.labelRotation) && (
          <AccordionItem value="axes" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Ejes y Escala
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              {options.axes && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Título Eje X</Label>
                    <Input
                      placeholder="Ej. Mes / Categoría"
                      value={formatConfig.axes?.xTitle || ""}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          axes: { ...formatConfig.axes, xTitle: e.target.value },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Título Eje Y</Label>
                    <Input
                      placeholder="Ej. Soles (S/)"
                      value={formatConfig.axes?.yTitle || ""}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          axes: { ...formatConfig.axes, yTitle: e.target.value },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </>
              )}

              {/* Rango Min/Max de Y (si yAxisRange es true) */}
              {caps.yAxisRange && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Y Mínimo (Min)</Label>
                    <Input
                      type="number"
                      placeholder="Auto"
                      value={formatConfig.axes?.yAxisMin ?? ""}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          axes: {
                            ...formatConfig.axes,
                            yAxisMin: e.target.value !== "" ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Y Máximo (Max)</Label>
                    <Input
                      type="number"
                      placeholder="Auto"
                      value={formatConfig.axes?.yAxisMax ?? ""}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          axes: {
                            ...formatConfig.axes,
                            yAxisMax: e.target.value !== "" ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Rotación de etiquetas de eje X */}
              {caps.labelRotation && (
                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-muted-foreground">Rotación de etiquetas (Eje X)</Label>
                  <select
                    value={formatConfig.axes?.labelRotation ?? 0}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        axes: {
                          ...formatConfig.axes,
                          labelRotation: Number(e.target.value) as 0 | 45 | -45,
                        },
                      })
                    }
                    className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value={0}>0° (Horizontal)</option>
                    <option value={45}>45° (Inclinado)</option>
                    <option value={-45}>-45° (Inclinado opuesto)</option>
                  </select>
                </div>
              )}

              {/* Cuadrículas X e Y */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Cuadrícula Y</Label>
                  <Switch
                    checked={formatConfig.axes?.showGridY ?? formatConfig.axes?.showGrid ?? true}
                    onCheckedChange={(checked) =>
                      updateWidgetFormat(widgetId, {
                        axes: {
                          ...formatConfig.axes,
                          showGrid: checked,
                          showGridY: checked,
                        },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Cuadrícula X</Label>
                  <Switch
                    checked={formatConfig.axes?.showGridX ?? false}
                    onCheckedChange={(checked) =>
                      updateWidgetFormat(widgetId, {
                        axes: {
                          ...formatConfig.axes,
                          showGridX: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 7: LÍNEA DE REFERENCIA (formatCaps.referenceLine) */}
        {caps.referenceLine && (
          <AccordionItem value="referenceLine" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Línea de Referencia
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mostrar línea objetivo/referencia</Label>
                <Switch
                  checked={formatConfig.referenceLine?.show ?? false}
                  onCheckedChange={(checked) =>
                    updateWidgetFormat(widgetId, {
                      referenceLine: {
                        show: checked,
                        value: formatConfig.referenceLine?.value ?? 0,
                        label: formatConfig.referenceLine?.label ?? "Meta",
                        color: formatConfig.referenceLine?.color ?? "#ef4444",
                      },
                    })
                  }
                />
              </div>

              {formatConfig.referenceLine?.show && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Valor numérico</Label>
                      <Input
                        type="number"
                        value={formatConfig.referenceLine.value}
                        onChange={(e) =>
                          updateWidgetFormat(widgetId, {
                            referenceLine: {
                              ...formatConfig.referenceLine,
                              show: true,
                              value: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Etiqueta</Label>
                      <Input
                        placeholder="Ej. Meta mensual"
                        value={formatConfig.referenceLine.label}
                        onChange={(e) =>
                          updateWidgetFormat(widgetId, {
                            referenceLine: {
                              ...formatConfig.referenceLine,
                              show: true,
                              label: e.target.value,
                            },
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Color de la línea</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formatConfig.referenceLine.color}
                        onChange={(e) =>
                          updateWidgetFormat(widgetId, {
                            referenceLine: {
                              ...formatConfig.referenceLine,
                              show: true,
                              color: e.target.value,
                            },
                          })
                        }
                        className="size-7 rounded border border-input cursor-pointer"
                      />
                      <span className="text-xs font-mono">{formatConfig.referenceLine.color}</span>
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 8: COLORES CONDICIONALES (formatCaps.conditionalColors) */}
        {caps.conditionalColors && (
          <AccordionItem value="conditionalColors" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Colores Condicionales
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Reglas de formato (máx. 5, orden prioritario)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(formatConfig.conditionalColors || []).length >= 5}
                  onClick={() => {
                    const currentRules = formatConfig.conditionalColors || [];
                    if (currentRules.length >= 5) return;
                    const newRule: ConditionalColorRule = {
                      condition: "greaterThan",
                      threshold: 1000,
                      color: "#10b981",
                    };
                    updateWidgetFormat(widgetId, {
                      conditionalColors: [...currentRules, newRule],
                    });
                  }}
                  className="h-6 text-[10px] gap-1 px-2 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>Agregar regla</span>
                </Button>
              </div>

              {(formatConfig.conditionalColors || []).length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-2 bg-muted/20 rounded border border-dashed border-border/60">
                  Sin reglas condicionales activas
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(formatConfig.conditionalColors || []).map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg border border-border bg-background/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Regla #{idx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            const filtered = (formatConfig.conditionalColors || []).filter(
                              (_, rIdx) => rIdx !== idx
                            );
                            updateWidgetFormat(widgetId, {
                              conditionalColors: filtered,
                            });
                          }}
                          className="size-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Condición</Label>
                          <select
                            value={rule.condition}
                            onChange={(e) => {
                              const updated = [...(formatConfig.conditionalColors || [])];
                              updated[idx] = {
                                ...updated[idx],
                                condition: e.target.value as "greaterThan" | "lessThan" | "between",
                              };
                              updateWidgetFormat(widgetId, { conditionalColors: updated });
                            }}
                            className="w-full h-7 text-xs rounded-md border border-input bg-background px-1 text-foreground"
                          >
                            <option value="greaterThan">Mayor que (&gt;)</option>
                            <option value="lessThan">Menor que (&lt;)</option>
                            <option value="between">Entre (rango)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            {rule.condition === "between" ? "Mínimo" : "Umbral"}
                          </Label>
                          <Input
                            type="number"
                            value={rule.threshold}
                            onChange={(e) => {
                              const updated = [...(formatConfig.conditionalColors || [])];
                              updated[idx] = {
                                ...updated[idx],
                                threshold: Number(e.target.value) || 0,
                              };
                              updateWidgetFormat(widgetId, { conditionalColors: updated });
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>

                      {rule.condition === "between" && (
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Máximo</Label>
                          <Input
                            type="number"
                            value={rule.threshold2 ?? 2000}
                            onChange={(e) => {
                              const updated = [...(formatConfig.conditionalColors || [])];
                              updated[idx] = {
                                ...updated[idx],
                                threshold2: Number(e.target.value) || 0,
                              };
                              updateWidgetFormat(widgetId, { conditionalColors: updated });
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-foreground">Color resultante</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={rule.color}
                            onChange={(e) => {
                              const updated = [...(formatConfig.conditionalColors || [])];
                              updated[idx] = {
                                ...updated[idx],
                                color: e.target.value,
                              };
                              updateWidgetFormat(widgetId, { conditionalColors: updated });
                            }}
                            className="size-6 rounded border border-input cursor-pointer"
                          />
                          <span className="text-[10px] font-mono">{rule.color}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 9: FORMATO NUMÉRICO */}
        {options.numberFormat && (
          <AccordionItem value="numberFormat" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Formato de Números
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Prefijo</Label>
                  <Input
                    placeholder="S/ "
                    value={formatConfig.numberFormat?.prefix || ""}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        numberFormat: {
                          decimals: formatConfig.numberFormat?.decimals ?? 2,
                          prefix: e.target.value,
                          compact: formatConfig.numberFormat?.compact ?? false,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Decimales</Label>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    value={formatConfig.numberFormat?.decimals ?? 2}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        numberFormat: {
                          prefix: formatConfig.numberFormat?.prefix ?? "S/ ",
                          decimals: Math.max(0, Math.min(4, Number(e.target.value))),
                          compact: formatConfig.numberFormat?.compact ?? false,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs">Formato compacto (K, M)</Label>
                <Switch
                  checked={formatConfig.numberFormat?.compact ?? false}
                  onCheckedChange={(checked) =>
                    updateWidgetFormat(widgetId, {
                      numberFormat: {
                        prefix: formatConfig.numberFormat?.prefix ?? "S/ ",
                        decimals: formatConfig.numberFormat?.decimals ?? 2,
                        compact: checked,
                      },
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 10: FONDO Y BORDE */}
        <AccordionItem value="border" className="border border-border/80 rounded-lg bg-card/60 px-3">
          <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
            Fondo y Borde
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar borde</Label>
              <Switch
                checked={formatConfig.border?.show ?? false}
                onCheckedChange={(checked) =>
                  updateWidgetFormat(widgetId, {
                    border: {
                      ...formatConfig.border,
                      show: checked,
                      color: formatConfig.border?.color || "#e2e8f0",
                      radius: formatConfig.border?.radius ?? 12,
                      width: 1,
                    },
                  })
                }
              />
            </div>

            {formatConfig.border?.show && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Radio esquina</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={formatConfig.border?.radius ?? 12}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        border: {
                          ...formatConfig.border,
                          show: true,
                          radius: Number(e.target.value),
                          color: formatConfig.border?.color || "#e2e8f0",
                          width: 1,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Color borde</Label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={formatConfig.border?.color || "#e2e8f0"}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          border: {
                            ...formatConfig.border,
                            show: true,
                            color: e.target.value,
                            radius: formatConfig.border?.radius ?? 12,
                            width: 1,
                          },
                        })
                      }
                      className="size-7 rounded border border-input cursor-pointer"
                    />
                    <span className="text-[10px] font-mono">{formatConfig.border?.color || "#e2e8f0"}</span>
                  </div>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function ColorPickerPopover({
  currentColor,
  onColorChange,
}: {
  currentColor: string;
  onColorChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-[11px] text-muted-foreground">Color de serie principal</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex items-center gap-1.5 px-2 py-1 rounded border border-input bg-background hover:bg-muted/40 cursor-pointer">
          <div className="size-4 rounded-full border border-border" style={{ backgroundColor: currentColor }} />
          <span className="text-[10px] font-mono">{currentColor}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <HexColorPicker color={currentColor} onChange={onColorChange} />
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-7 text-xs font-mono"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
