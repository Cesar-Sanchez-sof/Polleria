import { create } from "zustand";
import type {
  WidgetConfig,
  VisualType,
  WidgetDataConfig,
  WidgetFormatConfig,
} from "@/lib/dashboards/widget-schema";
import { createDefaultWidgetConfig } from "@/lib/dashboards/widget-schema";

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
  setWidgets: (widgets: CanvasWidget[]) => void;
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

  // Selector / Helper
  getSelectedWidget: () => CanvasWidget | null;
  resetStore: () => void;
}

export const useDashboardEditorStore = create<DashboardEditorState>((set, get) => ({
  widgets: [],
  selectedWidgetId: null,
  isDirty: false,

  setWidgets: (widgets) => {
    set({
      widgets,
      selectedWidgetId: widgets.length > 0 ? widgets[0].id : null,
      isDirty: false,
    });
  },

  addWidget: (widgetPartial) => {
    const id = widgetPartial?.id || `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const visualType: VisualType = widgetPartial?.config?.visualType || "column";
    const dataset = widgetPartial?.config?.data?.dataset || "ventas";
    const defaultConfig = createDefaultWidgetConfig(visualType, widgetPartial?.title || "Nuevo Visual", dataset);

    const newWidget: CanvasWidget = {
      id,
      title: widgetPartial?.title || defaultConfig.format.title.text,
      type: visualType,
      metricKey: dataset,
      x: widgetPartial?.x ?? 0,
      y: widgetPartial?.y ?? 0,
      w: widgetPartial?.w ?? 6,
      h: widgetPartial?.h ?? 4,
      config: widgetPartial?.config ? { ...defaultConfig, ...widgetPartial.config } : defaultConfig,
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
        return {
          ...w,
          type: visualType,
          config: {
            ...w.config,
            visualType,
          },
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
