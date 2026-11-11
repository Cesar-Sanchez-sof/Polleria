import { create } from "zustand";
import type {
  WidgetConfig,
  VisualType,
  WidgetDataConfig,
  WidgetFormatConfig,
  MeasureAggregation,
  WidgetDateRange,
  WidgetSort,
  DateGranularity,
} from "@/lib/dashboards/widget-schema";
import {
  adaptLegacyWidget,
  createUnconfiguredWidgetConfig,
} from "@/lib/dashboards/legacy-adapter";
import { migrateWidgetConfigOnVisualTypeChange } from "@/lib/dashboards/compatibility";
import { getVisualRegistryEntry } from "@/lib/dashboards/visual-registry";

export interface RawWidgetInput {
  id?: string;
  title?: string;
  type?: string;
  metricKey?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: unknown;
}

export interface CanvasWidget {
  id: string;
  title: string;
  type: string;
  metricKey?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: WidgetConfig;
}

export interface DashboardEditorState {
  /** Lista de widgets en el lienzo */
  widgets: CanvasWidget[];
  /** ID del widget actualmente seleccionado para edición en el panel lateral */
  selectedWidgetId: string | null;
  /** Estado de si existen cambios sin guardar en el lienzo */
  isDirty: boolean;

  // Acciones de Gestión de Widgets
  setWidgets: (widgets: RawWidgetInput[]) => void;
  addWidget: (widgetPartial?: Partial<CanvasWidget>) => string;
  removeWidget: (widgetId: string) => void;
  selectWidget: (widgetId: string | null) => void;
  updateWidgetLayout: (
    widgetId: string,
    layout: { x: number; y: number; w: number; h: number }
  ) => void;

  // Acciones en Tiempo Real sobre el Config estilo Power BI
  updateWidgetConfig: (widgetId: string, partialConfig: Partial<WidgetConfig>) => void;
  updateWidgetVisualType: (widgetId: string, visualType: VisualType) => void;
  updateWidgetData: (widgetId: string, partialData: Partial<WidgetDataConfig>) => void;
  updateWidgetFormat: (widgetId: string, partialFormat: Partial<WidgetFormatConfig>) => void;
  updateWidgetTitle: (widgetId: string, title: string) => void;

  // Acciones granulares de Pozos y Dataset (UI B1)
  changeWidgetDataset: (
    widgetId: string,
    dataset: string,
    options?: { defaultDateField?: string; isTransactional?: boolean }
  ) => void;
  assignFieldToWell: (
    widgetId: string,
    well: "axis" | "legend" | "values" | "values_column" | "values_line" | "values_x" | "values_y" | "values_size",
    fieldId: string,
    agg?: MeasureAggregation
  ) => void;
  removeFieldFromWell: (
    widgetId: string,
    well: "axis" | "legend" | "values" | "values_column" | "values_line" | "values_x" | "values_y" | "values_size",
    indexOrField?: number | string
  ) => void;
  updateMeasureAggregation: (
    widgetId: string,
    index: number,
    agg: MeasureAggregation
  ) => void;
  updateWidgetDateRange: (
    widgetId: string,
    dateRange?: WidgetDateRange
  ) => void;
  updateWidgetSort: (widgetId: string, sort?: WidgetSort) => void;
  updateWidgetLimit: (widgetId: string, limit?: number) => void;
  updateWidgetGranularity: (widgetId: string, granularity?: DateGranularity) => void;
  updateWidgetLegendGranularity: (widgetId: string, legendGranularity?: DateGranularity) => void;
  updateWidgetCompare: (widgetId: string, compare?: "previousPeriod") => void;

  // Selector / Helper
  getSelectedWidget: () => CanvasWidget | null;
  resetStore: () => void;
}

export const useDashboardEditorStore = create<DashboardEditorState>((set, get) => ({
  widgets: [],
  selectedWidgetId: null,
  isDirty: false,

  setWidgets: (rawWidgets) => {
    const adaptedWidgets: CanvasWidget[] = (rawWidgets || []).map((w) => {
      const config = adaptLegacyWidget(w);
      return {
        id: w.id || `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: w.title || config.format.title.text,
        type: config.visualType,
        metricKey: config.data.dataset || w.metricKey || "",
        x: w.x ?? 0,
        y: w.y ?? 0,
        w: w.w ?? 4,
        h: w.h ?? 2,
        config,
      };
    });

    set({
      widgets: adaptedWidgets,
      selectedWidgetId: adaptedWidgets.length > 0 ? adaptedWidgets[0].id : null,
      isDirty: false,
    });
  },

  addWidget: (widgetPartial) => {
    const id = widgetPartial?.id || `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = widgetPartial?.title || "Visual sin configurar";
    const config = widgetPartial?.config || createUnconfiguredWidgetConfig(title);

    const currentWidgets = get().widgets;
    const maxY = currentWidgets.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 4)), 0);

    const regEntry = getVisualRegistryEntry(config.visualType);
    const defW = regEntry.defaultSize.w;
    const defH = regEntry.defaultSize.h;

    const newWidget: CanvasWidget = {
      id,
      title: widgetPartial?.title || config.format.title.text,
      type: config.visualType,
      metricKey: config.data.dataset || "",
      x: widgetPartial?.x ?? 0,
      y: widgetPartial?.y ?? maxY,
      w: widgetPartial?.w ?? defW,
      h: widgetPartial?.h ?? defH,
      config,
    };

    set((state) => ({
      widgets: [...state.widgets, newWidget],
      selectedWidgetId: id,
      isDirty: true,
    }));

    return id;
  },

  removeWidget: (widgetId) => {
    set((state) => {
      const filtered = state.widgets.filter((w) => w.id !== widgetId);
      const nextSelected =
        state.selectedWidgetId === widgetId
          ? filtered.length > 0
            ? filtered[0].id
            : null
          : state.selectedWidgetId;

      return {
        widgets: filtered,
        selectedWidgetId: nextSelected,
        isDirty: true,
      };
    });
  },

  selectWidget: (widgetId) => {
    set({ selectedWidgetId: widgetId });
  },

  updateWidgetLayout: (widgetId, layout) => {
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              x: layout.x,
              y: layout.y,
              w: layout.w,
              h: layout.h,
            }
          : w
      ),
      isDirty: true,
    }));
  },

  updateWidgetConfig: (widgetId, partialConfig) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            ...partialConfig,
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetVisualType: (widgetId, visualType) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const migratedConfig = migrateWidgetConfigOnVisualTypeChange(w.config, visualType);
        return {
          ...w,
          type: visualType,
          config: migratedConfig,
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetData: (widgetId, partialData) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const newDataset = partialData.dataset || w.config.data.dataset;
        return {
          ...w,
          metricKey: newDataset,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              ...partialData,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetFormat: (widgetId, partialFormat) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          title: partialFormat.title?.text ?? w.title,
          config: {
            ...w.config,
            format: {
              ...w.config.format,
              ...partialFormat,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetTitle: (widgetId, title) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          title,
          config: {
            ...w.config,
            format: {
              ...w.config.format,
              title: {
                ...w.config.format.title,
                text: title,
              },
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  changeWidgetDataset: (widgetId, dataset, options) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const isTransactional = Boolean(options?.isTransactional);
        const defaultDateField = options?.defaultDateField;

        return {
          ...w,
          metricKey: dataset,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              dataset,
              axis: undefined,
              legend: undefined,
              granularity: undefined,
              values: [],
              filters: [],
              dateRange:
                isTransactional && defaultDateField
                  ? { field: defaultDateField, preset: "thisMonth" }
                  : undefined,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  assignFieldToWell: (widgetId, well, fieldId, agg = "sum") => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const visualType = w.config.visualType;
        const currentData = w.config.data;

        if (well === "axis") {
          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                axis: fieldId,
              },
            },
          };
        }

        if (well === "legend") {
          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                legend: fieldId,
              },
            },
          };
        }

        if (well === "values_column" || well === "values_line") {
          const series: "column" | "line" = well === "values_column" ? "column" : "line";
          const exists = currentData.values.some((v) => v.field === fieldId && v.series === series);
          const nextValues = exists
            ? currentData.values
            : [...currentData.values, { field: fieldId, agg, series }];

          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                values: nextValues,
              },
            },
          };
        }

        if (well === "values_x" || well === "values_y" || well === "values_size") {
          const series: "x" | "y" | "size" =
            well === "values_x" ? "x" : well === "values_y" ? "y" : "size";
          const filtered = currentData.values.filter((v) => v.series !== series);
          const nextValues = [...filtered, { field: fieldId, agg, series }];

          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                values: nextValues,
              },
            },
          };
        }

        if (well === "values") {
          const reg = getVisualRegistryEntry(visualType);
          const valWell = reg.wells.find((wl) => wl.role === "values" || wl.role === "values_column");
          const isSingleValue = valWell?.max === 1;
          let nextValues = [...currentData.values];

          if (isSingleValue) {
            nextValues = [{ field: fieldId, agg }];
          } else {
            // Si ya existe la medida exacta, no duplicar; sino agregar
            const exists = nextValues.some((v) => v.field === fieldId);
            if (!exists) {
              nextValues.push({ field: fieldId, agg });
            }
          }

          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                values: nextValues,
              },
            },
          };
        }

        return w;
      }),
      isDirty: true,
    }));
  },

  removeFieldFromWell: (widgetId, well, indexOrField) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const currentData = w.config.data;

        if (well === "axis") {
          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                axis: undefined,
                granularity: undefined,
              },
            },
          };
        }

        if (well === "legend") {
          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                legend: undefined,
              },
            },
          };
        }

        if (well === "values_column" || well === "values_line") {
          const series: "column" | "line" = well === "values_column" ? "column" : "line";
          let nextValues = [...currentData.values];
          if (typeof indexOrField === "number") {
            const matchingIndices: number[] = [];
            currentData.values.forEach((v, idx) => {
              if ((v.series || "column") === series) matchingIndices.push(idx);
            });
            const actualIndex = matchingIndices[indexOrField];
            if (actualIndex !== undefined) {
              nextValues = nextValues.filter((_, idx) => idx !== actualIndex);
            }
          } else if (typeof indexOrField === "string") {
            nextValues = nextValues.filter((v) => !(v.field === indexOrField && (v.series || "column") === series));
          } else {
            nextValues = nextValues.filter((v) => (v.series || "column") !== series);
          }

          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                values: nextValues,
              },
            },
          };
        }

        if (well === "values_x" || well === "values_y" || well === "values_size") {
          const series: "x" | "y" | "size" =
            well === "values_x" ? "x" : well === "values_y" ? "y" : "size";
          const nextValues = currentData.values.filter((v) => v.series !== series);
          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                values: nextValues,
              },
            },
          };
        }

        if (well === "values") {
          let nextValues = [...currentData.values];
          if (typeof indexOrField === "number") {
            nextValues = nextValues.filter((_, idx) => idx !== indexOrField);
          } else if (typeof indexOrField === "string") {
            nextValues = nextValues.filter((v) => v.field !== indexOrField);
          } else {
            nextValues = [];
          }

          return {
            ...w,
            config: {
              ...w.config,
              data: {
                ...currentData,
                values: nextValues,
              },
            },
          };
        }

        return w;
      }),
      isDirty: true,
    }));
  },

  updateMeasureAggregation: (widgetId, index, agg) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const nextValues = w.config.data.values.map((v, idx) =>
          idx === index ? { ...v, agg } : v
        );
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              values: nextValues,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetDateRange: (widgetId, dateRange) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              dateRange,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetSort: (widgetId, sort) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              sort,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetLimit: (widgetId, limit) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              limit,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetGranularity: (widgetId, granularity) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              granularity,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetLegendGranularity: (widgetId, legendGranularity) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              legendGranularity,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  updateWidgetCompare: (widgetId, compare) => {
    set((state) => ({
      widgets: state.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            data: {
              ...w.config.data,
              compare,
            },
          },
        };
      }),
      isDirty: true,
    }));
  },

  getSelectedWidget: () => {
    const { widgets, selectedWidgetId } = get();
    if (!selectedWidgetId) return null;
    return widgets.find((w) => w.id === selectedWidgetId) || null;
  },

  resetStore: () => {
    set({
      widgets: [],
      selectedWidgetId: null,
      isDirty: false,
    });
  },
}));
