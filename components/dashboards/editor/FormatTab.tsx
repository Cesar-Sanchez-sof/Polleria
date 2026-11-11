"use client";

import React, { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { DEFAULT_PALETTES } from "@/lib/dashboards/widget-schema";
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

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-24 m-0">
      <Accordion
        multiple
        defaultValue={["title", "colors", "labels", "legend", "axes", "numberFormat", "gauge"]}
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

        {/* SECCIÓN 2: COLORES & PALETAS */}
        <AccordionItem value="colors" className="border border-border/80 rounded-lg bg-card/60 px-3">
          <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
            Colores
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Paleta temática</Label>
              <select
                value={formatConfig.colors.palette || "polleria"}
                onChange={(e) => {
                  const palName = e.target.value;
                  const series = DEFAULT_PALETTES[palName] || DEFAULT_PALETTES.polleria;
                  updateWidgetFormat(widgetId, {
                    colors: {
                      ...formatConfig.colors,
                      palette: palName,
                      series,
                      custom: undefined,
                    },
                  });
                }}
                className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="polleria">Pollería (Cálida y Fuego)</option>
                <option value="modern">Moderno (Multicolor)</option>
                <option value="warm">Cálido (Rojos y Ámbar)</option>
                <option value="cool">Frío (Azules y Violetas)</option>
              </select>
            </div>

            <ColorPickerPopover
              currentColor={formatConfig.colors.custom?.[0] || formatConfig.colors.series[0] || "#ef4444"}
              onColorChange={(newColor) =>
                updateWidgetFormat(widgetId, {
                  colors: {
                    ...formatConfig.colors,
                    custom: [newColor],
                  },
                })
              }
            />
          </AccordionContent>
        </AccordionItem>

        {/* SECCIÓN FORMATO NUMÉRICO (Card y Gauge) */}
        {options.numberFormat && (
          <AccordionItem value="numberFormat" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Formato Numérico
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Prefijo de moneda / símbolo</Label>
                <Input
                  placeholder="Ej. S/ "
                  value={formatConfig.numberFormat?.prefix ?? "S/ "}
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
                <Label className="text-[11px] text-muted-foreground">Decimales (0 a 4)</Label>
                <Input
                  type="number"
                  min={0}
                  max={4}
                  value={formatConfig.numberFormat?.decimals ?? 2}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      numberFormat: {
                        decimals: Math.max(0, Math.min(4, Number(e.target.value) || 0)),
                        prefix: formatConfig.numberFormat?.prefix ?? "S/ ",
                        compact: formatConfig.numberFormat?.compact ?? false,
                      },
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <Label className="text-xs">Abreviar miles / millones</Label>
                  <span className="text-[10px] text-muted-foreground">Muestra 14.8K / 1.2M</span>
                </div>
                <Switch
                  checked={formatConfig.numberFormat?.compact ?? false}
                  onCheckedChange={(checked) =>
                    updateWidgetFormat(widgetId, {
                      numberFormat: {
                        decimals: formatConfig.numberFormat?.decimals ?? 2,
                        prefix: formatConfig.numberFormat?.prefix ?? "S/ ",
                        compact: checked,
                      },
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN MEDIDOR (GAUGE) */}
        {options.gauge && (
          <AccordionItem value="gauge" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Configuración de Medidor
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Valor Mínimo</Label>
                  <Input
                    type="number"
                    value={formatConfig.gauge?.min ?? 0}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        gauge: {
                          ...formatConfig.gauge,
                          min: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Valor Máximo</Label>
                  <Input
                    type="number"
                    placeholder="Auto (1.25x)"
                    value={formatConfig.gauge?.max ?? ""}
                    onChange={(e) =>
                      updateWidgetFormat(widgetId, {
                        gauge: {
                          ...formatConfig.gauge,
                          max: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Meta / Objetivo (Target)</Label>
                <Input
                  type="number"
                  placeholder="Ej. 10000"
                  value={formatConfig.gauge?.target ?? ""}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      gauge: {
                        ...formatConfig.gauge,
                        target: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="h-7 text-xs"
                />
                <span className="text-[10px] text-muted-foreground">
                  El medidor cambia a verde al superar este valor.
                </span>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 3: ETIQUETAS DE DATOS */}
        {options.dataLabels && (
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
                      value={formatConfig.dataLabels?.position || "top"}
                      onChange={(e) =>
                        updateWidgetFormat(widgetId, {
                          dataLabels: { ...formatConfig.dataLabels, position: e.target.value },
                        })
                      }
                      className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      <option value="top">Superior / Fuera</option>
                      <option value="inside">Dentro</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Tamaño</Label>
                    <Input
                      type="number"
                      min={9}
                      max={16}
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

        {/* SECCIÓN 4: LEYENDA */}
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
                  <Label className="text-[11px] text-muted-foreground">Posición de leyenda</Label>
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

        {/* SECCIÓN 5: EJES & CUADRÍCULA */}
        {options.axes && (
          <AccordionItem value="axes" className="border border-border/80 rounded-lg bg-card/60 px-3">
            <AccordionTrigger className="text-xs font-semibold py-2.5 hover:no-underline">
              Ejes y Cuadrícula
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Título Eje X</Label>
                <Input
                  placeholder="Ej. Mes / Plato / Categoría"
                  value={formatConfig.axes?.xTitle || ""}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      axes: { ...formatConfig.axes, xTitle: e.target.value, showGrid: formatConfig.axes?.showGrid ?? true },
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Título Eje Y Principal</Label>
                <Input
                  placeholder="Ej. Soles (S/) / Cantidad"
                  value={formatConfig.axes?.yTitle || ""}
                  onChange={(e) =>
                    updateWidgetFormat(widgetId, {
                      axes: { ...formatConfig.axes, yTitle: e.target.value, showGrid: formatConfig.axes?.showGrid ?? true },
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              {/* Eje Secundario para Combo */}
              {options.secondaryAxis && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Activar Eje Y Secundario (Líneas)</Label>
                    <Switch
                      checked={formatConfig.axes?.showSecondaryY ?? false}
                      onCheckedChange={(checked) =>
                        updateWidgetFormat(widgetId, {
                          axes: { ...formatConfig.axes, showSecondaryY: checked },
                        })
                      }
                    />
                  </div>
                  {formatConfig.axes?.showSecondaryY && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Título Eje Y Secundario</Label>
                      <Input
                        placeholder="Ej. Margen % / Unidades"
                        value={formatConfig.axes?.secondaryYTitle || ""}
                        onChange={(e) =>
                          updateWidgetFormat(widgetId, {
                            axes: { ...formatConfig.axes, secondaryYTitle: e.target.value },
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {options.gridlines && (
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-xs">Mostrar cuadrícula</Label>
                  <Switch
                    checked={formatConfig.axes?.showGrid ?? true}
                    onCheckedChange={(checked) =>
                      updateWidgetFormat(widgetId, {
                        axes: { ...formatConfig.axes, showGrid: checked },
                      })
                    }
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* SECCIÓN 6: FONDO Y BORDE */}
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
