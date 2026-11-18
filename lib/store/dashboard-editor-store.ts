import { create } from "zustand";
import {
  type WidgetConfig,
  type VisualType,
  type WidgetDataConfig,
  type WidgetFormatConfig,
  type MeasureAggregation,
  type WidgetDateRange,
  type WidgetSort,
  type DateGranularity,
  type DatePreset,
  createDefaultWidgetConfig,
} from "@/lib/dashboards/widget-schema";
import {
  adaptLegacyWidget,
  createUnconfiguredWidgetConfig,
} from "@/lib/dashboards/legacy-adapter";
import { migrateWidgetConfigOnVisualTypeChange } from "@/lib/dashboards/compatibility";
import { getVisualRegistryEntry } from "@/lib/dashboards/visual-registry";

export const MAX_HISTORY = 30;

/**
 * Mapeo de claves 'rawValue' para Filtro Cruzado (Cross-Filtering) por tipo de visual:
 *
 * - Gráficos con Eje X (bar, column, stackedBar, stackedColumn, percentBar, line, area, stackedArea, combo):
 *   - Al hacer clic en una categoría o barra/punto:
 *     Usa `axisRawValue` (fallback: `rawValue`) asociado al campo `config.data.axis`.
 *   - Si el visual contiene serie dividida por leyenda (legend) y se selecciona una serie específica:
 *     Usa `legendRawValue` asociado al campo `config.data.legend`.
 *
 * - Gráficos Radiales y Proporcionales (pie, donut):
 *   - Al hacer clic en un sector/rebanada:
 *     Usa `axisRawValue` (fallback: `rawValue`) correspondiente al campo de categoría `config.data.axis`.
 *
 * - Gráficos Jerárquicos y de Distribución (treemap):
 *   - Al hacer clic en un nodo/celda:
 *     Usa `axisRawValue` (fallback: `rawValue`) sobre el campo `config.data.axis`.
 *
 * - Gráficos Bidimensionales Matriciales (heatmap, matrix):
 *   - Al hacer clic en una celda o fila:
 *     Gana siempre la dimensión del eje principal (eje Y / filas), despachando `axisRawValue`
 *     (fallback: `rawValue`) sobre el campo `config.data.axis`.
 *
 * - Tablas de Datos (table):
 *   - Al hacer clic en una fila o celda de dimensión:
 *     Usa `axisRawValue` (o `rawValue`) de la fila correspondiente sobre el campo de dimensión.
 *
 * - Visuales de Tarjeta e Indicadores (card, multiCard, gauge, kpiTrend):
 *   - No emiten eventos de filtro cruzado (son receptores o consumidores pasivos de filtros cruzados).
 */
export interface CrossFilterState {
  datasetId: string;
  field: string;
  granularity?: string;
  value: string | number | boolean | (string | number)[];
  display: string;
  sourceWidgetId: string;
}

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

export function cloneWidgets(widgets: CanvasWidget[]): CanvasWidget[] {
  return JSON.parse(JSON.stringify(widgets));
}

/**
 * Compacta verticalmente los widgets sin solapar conservando sus anchos y columnas.
 */
export function compactLayoutVertical(widgets: CanvasWidget[]): CanvasWidget[] {
  const sorted = [...widgets].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const placed: CanvasWidget[] = [];

  for (const item of sorted) {
    if (item.config.layout?.locked) {
      placed.push(item);
      continue;
    }

    const xCollisions = placed.filter(
      (p) => item.x < p.x + p.w && item.x + item.w > p.x
    );

    const candidateYs = [0, ...xCollisions.map((p) => p.y + p.h)].sort((a, b) => a - b);

    let chosenY = 0;
    for (const candY of candidateYs) {
      const collides = xCollisions.some(
        (p) => candY < p.y + p.h && candY + item.h > p.y
      );
      if (!collides) {
        chosenY = candY;
        break;
      }
    }

    placed.push({
      ...item,
      y: chosenY,
    });
  }

  return widgets.map((w) => placed.find((p) => p.id === w.id) || w);
}

export interface DashboardEditorState {
  /** Lista de widgets en el lienzo */
  widgets: CanvasWidget[];
  /** ID del widget actualmente seleccionado para edición en el panel lateral */
  selectedWidgetId: string | null;
  /** IDs de los widgets seleccionados (soporte selección múltiple) */
  selectedWidgetIds: string[];
  /** Portapapeles de widgets para copiar y pegar */
  clipboard: CanvasWidget[];
  /** Nivel de zoom del lienzo (50% a 150%) */
  zoom: number;
  /** Estado de si existen cambios sin guardar en el lienzo */
  isDirty: boolean;

  // Historial de cambios estilo Power BI
  history: CanvasWidget[][];
  historyIndex: number;
  savedSnapshotIndex: number | null;
  canUndo: boolean;
  canRedo: boolean;

  // Lienzo & UI
  isGridVisible: boolean;
  focusedWidgetId: string | null;
  isRefreshing: boolean;
  isPreviewMode: boolean;

  // Filtro Cruzado (Cross-Filter)
  crossFilters: CrossFilterState | null;
  setCrossFilter: (filter: CrossFilterState) => void;
  clearCrossFilters: () => void;

  // Filtro de Fecha Global
  globalDateRange: { preset: DatePreset; from?: string; to?: string } | null;
  setGlobalDateRange: (range: { preset: DatePreset; from?: string; to?: string } | null) => void;

  // Acciones de Gestión de Widgets
  setWidgets: (widgets: RawWidgetInput[]) => void;
  addWidget: (widgetPartial?: Partial<CanvasWidget>) => string;
  addTextWidget: () => string;
  addDividerWidget: () => string;
  addImageWidget: (content: string) => string;
  removeWidget: (widgetId: string) => void;
  selectWidget: (widgetId: string | null, multi?: boolean) => void;
  selectWidgets: (widgetIds: string[]) => void;
  duplicateWidget: (widgetId?: string) => string | null;
  toggleLockWidget: (widgetId?: string) => void;
  autoFitWidgets: () => void;
  alignLeft: () => void;
  alignCenter: () => void;
  alignRight: () => void;
  distributeHorizontally: () => void;
  groupSelectedWidgets: () => void;
  ungroupSelectedWidgets: () => void;
  copySelectedWidgets: () => void;
  pasteWidgets: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  updateWidgetLayout: (
    widgetId: string,
    layout: { x: number; y: number; w: number; h: number },
    commitHistory?: boolean
  ) => void;
  commitLayoutChange: (
    layouts: readonly { i: string; x: number; y: number; w: number; h: number }[]
  ) => void;

  // Historial Actions
  undo: () => void;
  redo: () => void;
  markAsSaved: () => void;
  pushSnapshot: (newWidgets: CanvasWidget[], nextSelectedId?: string | null) => void;

  // Lienzo & UI Actions
  toggleGrid: () => void;
  setFocusedWidgetId: (widgetId: string | null) => void;
  setIsRefreshing: (isRefreshing: boolean) => void;
  togglePreviewMode: () => void;
  setIsPreviewMode: (isPreview: boolean) => void;

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

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function flushDebounceHistory(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    const store = useDashboardEditorStore.getState();
    store.pushSnapshot(store.widgets, store.selectedWidgetId);
  }
}

export const useDashboardEditorStore = create<DashboardEditorState>((set, get) => {
  const recordSnapshot = (
    newWidgets: CanvasWidget[],
    nextSelectedId?: string | null
  ) => {
    const state = get();
    const cloned = cloneWidgets(newWidgets);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(cloned);

    let newSavedIndex = state.savedSnapshotIndex;
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
      if (newSavedIndex !== null) {
        newSavedIndex = newSavedIndex - 1;
        if (newSavedIndex < 0) {
          newSavedIndex = null;
        }
      }
    }

    const nextIndex = newHistory.length - 1;
    const isDirty = newSavedIndex === null || nextIndex !== newSavedIndex;

    set({
      widgets: cloned,
      selectedWidgetId:
        nextSelectedId !== undefined ? nextSelectedId : state.selectedWidgetId,
      selectedWidgetIds:
        nextSelectedId !== undefined
          ? nextSelectedId
            ? [nextSelectedId]
            : []
          : state.selectedWidgetIds.filter((id) => cloned.some((w) => w.id === id)),
      history: newHistory,
      historyIndex: nextIndex,
      savedSnapshotIndex: newSavedIndex,
      canUndo: nextIndex > 0,
      canRedo: false,
      isDirty,
    });
  };

  return {
    widgets: [],
    selectedWidgetId: null,
    selectedWidgetIds: [],
    clipboard: [],
    zoom: 100,
    isDirty: false,

    history: [[]],
    historyIndex: 0,
    savedSnapshotIndex: 0,
    canUndo: false,
    canRedo: false,

    isGridVisible: true,
    focusedWidgetId: null,
    isRefreshing: false,
    isPreviewMode: false,
    crossFilters: null,
    globalDateRange: null,

    setGlobalDateRange: (range) => {
      set({ globalDateRange: range });
    },

    setCrossFilter: (filter) => {
      set((state) => {
        const current = state.crossFilters;
        // Toggle: Si el mismo dataset, campo y valor ya está activo → limpiar
        if (
          current &&
          current.datasetId === filter.datasetId &&
          current.field === filter.field &&
          JSON.stringify(current.value) === JSON.stringify(filter.value)
        ) {
          return { crossFilters: null };
        }
        return { crossFilters: filter };
      });
    },

    clearCrossFilters: () => {
      set({ crossFilters: null });
    },

    togglePreviewMode: () => {
      set((state) => ({ isPreviewMode: !state.isPreviewMode }));
    },

    setIsPreviewMode: (isPreview) => {
      set({ isPreviewMode: isPreview });
    },

    pushSnapshot: (newWidgets, nextSelectedId) => {
      recordSnapshot(newWidgets, nextSelectedId);
    },

    setWidgets: (rawWidgets) => {
      flushDebounceHistory();
      const adaptedWidgets: CanvasWidget[] = (rawWidgets || []).map((w) => {
        const config = adaptLegacyWidget(w);
        return {
          id: w.id || `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: w.title || config.format.title.text,
          type: w.type || config.visualType,
          metricKey: config.data.dataset || w.metricKey || "",
          x: w.x ?? 0,
          y: w.y ?? 0,
          w: w.w ?? (w.type === "divider" ? 12 : 4),
          h: w.h ?? (w.type === "divider" ? 1 : 2),
          config,
        };
      });

      const initialHistory = [cloneWidgets(adaptedWidgets)];

      set({
        widgets: adaptedWidgets,
        selectedWidgetId: adaptedWidgets.length > 0 ? adaptedWidgets[0].id : null,
        selectedWidgetIds: adaptedWidgets.length > 0 ? [adaptedWidgets[0].id] : [],
        isDirty: false,
        history: initialHistory,
        historyIndex: 0,
        savedSnapshotIndex: 0,
        canUndo: false,
        canRedo: false,
      });
    },

    addTextWidget: () => {
      flushDebounceHistory();
      const currentWidgets = get().widgets;
      const maxY = currentWidgets.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 2)), 0);
      const newId = `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const baseConfig = createDefaultWidgetConfig("card", "Texto", "");
      const newWidget: CanvasWidget = {
        id: newId,
        title: "Texto",
        type: "text",
        metricKey: "",
        x: 0,
        y: maxY,
        w: 6,
        h: 1,
        config: {
          ...baseConfig,
          visualType: "card",
          content: "Escribe un texto aquí...",
          fontSize: 22,
          bold: true,
          letterSpacing: "normal",
        },
      };
      const nextWidgets = [...currentWidgets, newWidget];
      recordSnapshot(nextWidgets, newId);
      return newId;
    },

    addDividerWidget: () => {
      flushDebounceHistory();
      const currentWidgets = get().widgets;
      const maxY = currentWidgets.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 2)), 0);
      const newId = `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const baseConfig = createDefaultWidgetConfig("card", "Separador", "");
      const newWidget: CanvasWidget = {
        id: newId,
        title: "Separador",
        type: "divider",
        metricKey: "",
        x: 0,
        y: maxY,
        w: 12,
        h: 1,
        config: {
          ...baseConfig,
          visualType: "card",
        },
      };
      const nextWidgets = [...currentWidgets, newWidget];
      recordSnapshot(nextWidgets, newId);
      return newId;
    },

    addImageWidget: (content: string) => {
      flushDebounceHistory();
      const currentWidgets = get().widgets;
      const maxY = currentWidgets.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 2)), 0);
      const newId = `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const baseConfig = createDefaultWidgetConfig("card", "Imagen", "");
      const newWidget: CanvasWidget = {
        id: newId,
        title: "Imagen",
        type: "image",
        metricKey: "",
        x: 0,
        y: maxY,
        w: 4,
        h: 3,
        config: {
          ...baseConfig,
          visualType: "card",
          content,
        },
      };
      const nextWidgets = [...currentWidgets, newWidget];
      recordSnapshot(nextWidgets, newId);
      return newId;
    },

    selectWidget: (widgetId, multi = false) => {
      set((state) => {
        if (!widgetId) {
          return { selectedWidgetId: null, selectedWidgetIds: [] };
        }
        if (multi) {
          const exists = state.selectedWidgetIds.includes(widgetId);
          const nextIds = exists
            ? state.selectedWidgetIds.filter((id) => id !== widgetId)
            : [...state.selectedWidgetIds, widgetId];
          return {
            selectedWidgetIds: nextIds,
            selectedWidgetId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
          };
        }
        return {
          selectedWidgetId: widgetId,
          selectedWidgetIds: [widgetId],
        };
      });
    },

    selectWidgets: (widgetIds) => {
      set({
        selectedWidgetIds: widgetIds,
        selectedWidgetId: widgetIds.length > 0 ? widgetIds[0] : null,
      });
    },

    alignLeft: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetIds } = get();
      if (selectedWidgetIds.length < 2) return;
      const selected = widgets.filter((w) => selectedWidgetIds.includes(w.id));
      const minX = Math.min(...selected.map((w) => w.x));
      const nextWidgets = widgets.map((w) =>
        selectedWidgetIds.includes(w.id) ? { ...w, x: minX } : w
      );
      recordSnapshot(nextWidgets);
    },

    alignCenter: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetIds } = get();
      if (selectedWidgetIds.length < 2) return;
      const selected = widgets.filter((w) => selectedWidgetIds.includes(w.id));
      const minX = Math.min(...selected.map((w) => w.x));
      const maxX = Math.max(...selected.map((w) => w.x + w.w));
      const centerX = minX + (maxX - minX) / 2;
      const nextWidgets = widgets.map((w) => {
        if (!selectedWidgetIds.includes(w.id)) return w;
        const newX = Math.max(0, Math.min(12 - w.w, Math.round(centerX - w.w / 2)));
        return { ...w, x: newX };
      });
      recordSnapshot(nextWidgets);
    },

    alignRight: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetIds } = get();
      if (selectedWidgetIds.length < 2) return;
      const selected = widgets.filter((w) => selectedWidgetIds.includes(w.id));
      const maxRight = Math.max(...selected.map((w) => w.x + w.w));
      const nextWidgets = widgets.map((w) => {
        if (!selectedWidgetIds.includes(w.id)) return w;
        const newX = Math.max(0, maxRight - w.w);
        return { ...w, x: newX };
      });
      recordSnapshot(nextWidgets);
    },

    distributeHorizontally: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetIds } = get();
      if (selectedWidgetIds.length < 3) return;
      const selected = widgets.filter((w) => selectedWidgetIds.includes(w.id));
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const step = (last.x - first.x) / (sorted.length - 1);
      const newPositions = new Map<string, number>();
      sorted.forEach((w, idx) => {
        newPositions.set(w.id, Math.round(first.x + idx * step));
      });
      const nextWidgets = widgets.map((w) => {
        const newX = newPositions.get(w.id);
        return newX !== undefined
          ? { ...w, x: Math.max(0, Math.min(12 - w.w, newX)) }
          : w;
      });
      recordSnapshot(nextWidgets);
    },

    groupSelectedWidgets: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetIds } = get();
      if (selectedWidgetIds.length < 2) return;
      const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nextWidgets = widgets.map((w) =>
        selectedWidgetIds.includes(w.id)
          ? {
              ...w,
              config: {
                ...w.config,
                groupId,
              },
            }
          : w
      );
      recordSnapshot(nextWidgets);
    },

    ungroupSelectedWidgets: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetIds } = get();
      if (selectedWidgetIds.length === 0) return;
      const selected = widgets.filter((w) => selectedWidgetIds.includes(w.id));
      const groupIds = new Set(
        selected.map((w) => (w.config as any)?.groupId).filter(Boolean)
      );
      if (groupIds.size === 0) return;
      const nextWidgets = widgets.map((w) => {
        const gId = (w.config as any)?.groupId;
        if (gId && groupIds.has(gId)) {
          const clonedConfig = { ...w.config };
          delete (clonedConfig as any).groupId;
          return {
            ...w,
            config: clonedConfig,
          };
        }
        return w;
      });
      recordSnapshot(nextWidgets);
    },

    copySelectedWidgets: () => {
      const { widgets, selectedWidgetIds, selectedWidgetId } = get();
      const idsToCopy =
        selectedWidgetIds.length > 0
          ? selectedWidgetIds
          : selectedWidgetId
            ? [selectedWidgetId]
            : [];
      if (idsToCopy.length === 0) return;
      const toCopy = widgets.filter((w) => idsToCopy.includes(w.id));
      const cloned = JSON.parse(JSON.stringify(toCopy));
      set({ clipboard: cloned });
    },

    pasteWidgets: () => {
      flushDebounceHistory();
      const { widgets, clipboard } = get();
      if (clipboard.length === 0) return;

      const oldToNewGroupMap = new Map<string, string>();
      const pastedWidgets: CanvasWidget[] = clipboard.map((orig) => {
        const newId = `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const clonedConfig = JSON.parse(JSON.stringify(orig.config));
        if (clonedConfig.groupId) {
          if (!oldToNewGroupMap.has(clonedConfig.groupId)) {
            oldToNewGroupMap.set(
              clonedConfig.groupId,
              `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
            );
          }
          clonedConfig.groupId = oldToNewGroupMap.get(clonedConfig.groupId);
        }
        const newX = Math.min(12 - orig.w, orig.x + 1);
        const newY = orig.y + 1;
        return {
          ...orig,
          id: newId,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          config: clonedConfig,
        };
      });

      const nextWidgets = [...widgets, ...pastedWidgets];
      const nextIds = pastedWidgets.map((w) => w.id);
      const nextSelectedId = nextIds[nextIds.length - 1] || null;

      set({ selectedWidgetIds: nextIds });
      recordSnapshot(nextWidgets, nextSelectedId);
    },

    zoomIn: () => {
      set((state) => ({ zoom: Math.min(150, state.zoom + 10) }));
    },

    zoomOut: () => {
      set((state) => ({ zoom: Math.max(50, state.zoom - 10) }));
    },

    resetZoom: () => {
      set({ zoom: 100 });
    },

    addWidget: (widgetPartial) => {
      flushDebounceHistory();
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

      const nextWidgets = [...currentWidgets, newWidget];
      recordSnapshot(nextWidgets, id);
      return id;
    },

    removeWidget: (widgetId) => {
      flushDebounceHistory();
      const state = get();
      const target = state.widgets.find((w) => w.id === widgetId);
      if (!target) return;
      // Si está bloqueado, no se elimina
      if (target.config.layout?.locked) {
        return;
      }

      const filtered = state.widgets.filter((w) => w.id !== widgetId);
      const nextSelected =
        state.selectedWidgetId === widgetId
          ? filtered.length > 0
            ? filtered[0].id
            : null
          : state.selectedWidgetId;

      recordSnapshot(filtered, nextSelected);
    },

    duplicateWidget: (widgetId) => {
      flushDebounceHistory();
      const { widgets, selectedWidgetId } = get();
      const targetId = widgetId || selectedWidgetId;
      if (!targetId) return null;
      const orig = widgets.find((w) => w.id === targetId);
      if (!orig) return null;

      const clonedConfig = JSON.parse(JSON.stringify(orig.config));
      const newId = `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newY = (orig.y ?? 0) + (orig.h ?? 2);

      const duplicatedWidget: CanvasWidget = {
        id: newId,
        title: orig.title,
        type: orig.type,
        metricKey: orig.metricKey,
        x: orig.x ?? 0,
        y: newY,
        w: orig.w ?? 4,
        h: orig.h ?? 2,
        config: clonedConfig,
      };

      const nextWidgets = [...widgets, duplicatedWidget];
      recordSnapshot(nextWidgets, newId);
      return newId;
    },

    toggleLockWidget: (widgetId) => {
      flushDebounceHistory();
      const { widgets, selectedWidgetId } = get();
      const targetId = widgetId || selectedWidgetId;
      if (!targetId) return;

      const nextWidgets = widgets.map((w) => {
        if (w.id !== targetId) return w;
        const currentLocked = Boolean(w.config.layout?.locked);
        const nextLocked = !currentLocked;
        return {
          ...w,
          config: {
            ...w.config,
            layout: {
              ...w.config.layout,
              locked: nextLocked,
            },
          },
        };
      });

      recordSnapshot(nextWidgets, targetId);
    },

    autoFitWidgets: () => {
      flushDebounceHistory();
      const { widgets, selectedWidgetId } = get();
      const compacted = compactLayoutVertical(widgets);
      recordSnapshot(compacted, selectedWidgetId);
    },

    updateWidgetLayout: (widgetId, layout, commitHistory = false) => {
      if (commitHistory) {
        flushDebounceHistory();
        const nextWidgets = get().widgets.map((w) =>
          w.id === widgetId
            ? {
                ...w,
                x: layout.x,
                y: layout.y,
                w: layout.w,
                h: layout.h,
              }
            : w
        );
        recordSnapshot(nextWidgets);
      } else {
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
      }
    },

    commitLayoutChange: (layouts) => {
      flushDebounceHistory();
      const { widgets, selectedWidgetId } = get();
      let changed = false;
      const nextWidgets = widgets.map((w) => {
        const item = layouts.find((l) => l.i === w.id);
        if (!item) return w;
        if (
          w.x !== item.x ||
          w.y !== item.y ||
          w.w !== item.w ||
          w.h !== item.h
        ) {
          changed = true;
          return {
            ...w,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          };
        }
        return w;
      });

      if (changed) {
        recordSnapshot(nextWidgets, selectedWidgetId);
      }
    },

    undo: () => {
      flushDebounceHistory();
      const { history, historyIndex, savedSnapshotIndex } = get();
      if (historyIndex <= 0) return;
      const newIndex = historyIndex - 1;
      const restoredWidgets = cloneWidgets(history[newIndex]);
      const isDirty =
        savedSnapshotIndex === null || newIndex !== savedSnapshotIndex;

      set({
        widgets: restoredWidgets,
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: true,
        isDirty,
      });
    },

    redo: () => {
      flushDebounceHistory();
      const { history, historyIndex, savedSnapshotIndex } = get();
      if (historyIndex >= history.length - 1) return;
      const newIndex = historyIndex + 1;
      const restoredWidgets = cloneWidgets(history[newIndex]);
      const isDirty =
        savedSnapshotIndex === null || newIndex !== savedSnapshotIndex;

      set({
        widgets: restoredWidgets,
        historyIndex: newIndex,
        canUndo: true,
        canRedo: newIndex < history.length - 1,
        isDirty,
      });
    },

    markAsSaved: () => {
      flushDebounceHistory();
      set({
        savedSnapshotIndex: get().historyIndex,
        isDirty: false,
      });
    },

    toggleGrid: () => {
      set((state) => ({ isGridVisible: !state.isGridVisible }));
    },

    setFocusedWidgetId: (widgetId) => {
      set({ focusedWidgetId: widgetId });
    },

    setIsRefreshing: (isRefreshing) => {
      set({ isRefreshing });
    },

    updateWidgetConfig: (widgetId, partialConfig) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          config: {
            ...w.config,
            ...partialConfig,
          },
        };
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetVisualType: (widgetId, visualType) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const migratedConfig = migrateWidgetConfigOnVisualTypeChange(w.config, visualType);
        return {
          ...w,
          type: visualType,
          config: migratedConfig,
        };
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetData: (widgetId, partialData) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetFormat: (widgetId, partialFormat) => {
      // Modifica widgets en tiempo real y debouncia snapshot 500ms
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

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const curr = get();
        curr.pushSnapshot(curr.widgets, curr.selectedWidgetId);
      }, 500);
    },

    updateWidgetTitle: (widgetId, title) => {
      // Modifica widgets en tiempo real y debouncia snapshot 500ms
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

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const curr = get();
        curr.pushSnapshot(curr.widgets, curr.selectedWidgetId);
      }, 500);
    },

    changeWidgetDataset: (widgetId, dataset, options) => {
      flushDebounceHistory();
      const isTransactional = Boolean(options?.isTransactional);
      const defaultDateField = options?.defaultDateField;

      const nextWidgets = get().widgets.map((w) => {
        if (w.id !== widgetId) return w;
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
                  ? { field: defaultDateField, preset: "thisMonth" as const }
                  : undefined,
            },
          },
        };
      });
      recordSnapshot(nextWidgets);
    },

    assignFieldToWell: (widgetId, well, fieldId, agg = "sum") => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });

      recordSnapshot(nextWidgets);
    },

    removeFieldFromWell: (widgetId, well, indexOrField) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });

      recordSnapshot(nextWidgets);
    },

    updateMeasureAggregation: (widgetId, index, agg) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetDateRange: (widgetId, dateRange) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetSort: (widgetId, sort) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetLimit: (widgetId, limit) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetGranularity: (widgetId, granularity) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetLegendGranularity: (widgetId, legendGranularity) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    updateWidgetCompare: (widgetId, compare) => {
      flushDebounceHistory();
      const nextWidgets = get().widgets.map((w) => {
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
      });
      recordSnapshot(nextWidgets);
    },

    getSelectedWidget: () => {
      const { widgets, selectedWidgetId } = get();
      if (!selectedWidgetId) return null;
      return widgets.find((w) => w.id === selectedWidgetId) || null;
    },

    resetStore: () => {
      flushDebounceHistory();
      set({
        widgets: [],
        selectedWidgetId: null,
        selectedWidgetIds: [],
        clipboard: [],
        zoom: 100,
        isDirty: false,
        history: [[]],
        historyIndex: 0,
        savedSnapshotIndex: 0,
        canUndo: false,
        canRedo: false,
        isGridVisible: true,
        focusedWidgetId: null,
        isRefreshing: false,
        isPreviewMode: false,
        crossFilters: null,
        globalDateRange: null,
      });
    },
  };
});
