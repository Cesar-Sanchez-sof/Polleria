"use client";

import React, { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  Save,
  Plus,
  X,
  GripHorizontal,
  Sliders,
  Lock,
  Unlock,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WidgetRenderer } from "./WidgetRenderer";
import { PropertiesPanel } from "./editor/PropertiesPanel";
import { EditorToolbar } from "./editor/EditorToolbar";
import { CrossFilterChip } from "./CrossFilterChip";
import { updateDashboardWidgetsAction } from "@/app/dashboards/config/actions";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { widgetConfigSchema } from "@/lib/dashboards/widget-schema";
import { adaptLegacyWidget } from "@/lib/dashboards/legacy-adapter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DashboardCanvasProps {
  isShareMode?: boolean;
  dashboard: {
    id: string;
    name: string;
    section?: { name: string } | null;
    isPublished: boolean;
    widgets: Array<{
      id?: string;
      title: string;
      type: string;
      metricKey: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      config?: unknown;
    }>;
  };
}

export function DashboardCanvas({ dashboard, isShareMode = false }: DashboardCanvasProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);

  // Medición dinámica de ancho para react-grid-layout
  const { width, containerRef, mounted } = useContainerWidth();

  // Store global de Zustand estilo Power BI
  const {
    widgets,
    selectedWidgetId,
    selectedWidgetIds,
    zoom,
    setWidgets,
    addWidget,
    removeWidget,
    selectWidget,
    updateWidgetLayout,
    commitLayoutChange,
    toggleLockWidget,
    isGridVisible,
    markAsSaved,
    isPreviewMode,
    togglePreviewMode,
  } = useDashboardEditorStore();

  // Inicializar widgets en el store al montar
  useEffect(() => {
    setWidgets(dashboard.widgets || []);
  }, [dashboard.widgets, setWidgets]);

  // Añadir visual vacío
  const handleAddEmptyVisual = () => {
    addWidget();
    toast.success("Nuevo visual añadido. Selecciona un tipo de visual y arrastra campos.");
  };

  // Manejador atómico de finalización de drag o resize con soporte de grupos
  const handleCommitMove = (
    newLayout: readonly { i: string; x: number; y: number; w: number; h: number }[],
    movedItem?: { i: string; x: number; y: number } | null
  ) => {
    isInteractingRef.current = false;
    const currentWidgets = useDashboardEditorStore.getState().widgets;
    const currentWidget = movedItem ? currentWidgets.find((w) => w.id === movedItem.i) : null;
    const groupId = (currentWidget?.config as Record<string, unknown>)?.groupId;

    let mergedLayout = currentWidgets.map((w) => {
      const fromNew = newLayout.find((l) => l.i === w.id);
      return fromNew || { i: w.id, x: w.x, y: w.y, w: w.w, h: w.h };
    });

    // Si el widget pertenece a un grupo, mover a todos los del grupo con el mismo delta
    if (groupId && movedItem && currentWidget) {
      const dx = movedItem.x - currentWidget.x;
      const dy = movedItem.y - currentWidget.y;
      if (dx !== 0 || dy !== 0) {
        mergedLayout = mergedLayout.map((item) => {
          const w = currentWidgets.find((cw) => cw.id === item.i);
          if (w && w.id !== movedItem.i && (w.config as Record<string, unknown>)?.groupId === groupId) {
            const newX = Math.max(0, Math.min(12 - item.w, item.x + dx));
            const newY = Math.max(0, item.y + dy);
            return { ...item, x: newX, y: newY };
          }
          return item;
        });
      }
    }

    commitLayoutChange(mergedLayout);
  };

  // Sincronizar pasivamente cuando NO hay interacción activa de arrastre o redimensión
  const handleLayoutChange = (
    newLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]
  ) => {
    if (isInteractingRef.current) return;
    const currentWidgets = useDashboardEditorStore.getState().widgets;
    const hasAnyChange = newLayout.some((item) => {
      const current = currentWidgets.find((w) => w.id === item.i);
      return current && (current.x !== item.x || current.y !== item.y || current.w !== item.w || current.h !== item.h);
    });
    if (hasAnyChange) {
      const mergedLayout = currentWidgets.map((w) => {
        const fromNew = newLayout.find((l) => l.i === w.id);
        return fromNew || { i: w.id, x: w.x, y: w.y, w: w.w, h: w.h };
      });
      commitLayoutChange(mergedLayout);
    }
  };

  // Guardar diseño persistiendo layout y config completo validado con Zod
  const handleSaveLayout = () => {
    startTransition(async () => {
      try {
        const payload = widgets.map((w) => {
          // Asegurar que el config esté 100% validado con el esquema Zod
          const validConfig = widgetConfigSchema.parse(
            w.config || adaptLegacyWidget(w)
          );

          return {
            title: w.title || validConfig.format.title.text,
            type: w.type || validConfig.visualType,
            metricKey: validConfig.data.dataset || "",
            x: w.x ?? 0,
            y: w.y ?? 0,
            w: w.w ?? 4,
            h: w.h ?? 2,
            config: validConfig as unknown as Record<string, unknown>,
          };
        });

        const res = await updateDashboardWidgetsAction(
          dashboard.id,
          payload as unknown as Parameters<typeof updateDashboardWidgetsAction>[1]
        );
        if (res.success) {
          markAsSaved();
          toast.success("Diseño del tablero guardado exitosamente");
          router.push(`/dashboards/${dashboard.id}`);
          router.refresh();
        } else {
          toast.error(res.error || "Error al guardar el diseño");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al validar la configuración del visual";
        toast.error(`Error de validación: ${msg}`);
      }
    });
  };

  // Mapeo para react-grid-layout con soporte de locked (static) y preview mode
  const layoutItems = widgets.map((w) => {
    const isLocked = Boolean(w.config.layout?.locked);
    const isStatic = isLocked || isPreviewMode;
    const isDesign =
      w.type === "text" ||
      w.type === "divider" ||
      w.type === "image" ||
      (w.config as Record<string, unknown>)?.visualType === "text" ||
      (w.config as Record<string, unknown>)?.visualType === "divider" ||
      (w.config as Record<string, unknown>)?.visualType === "image";

    return {
      i: w.id,
      x: w.x ?? 0,
      y: w.y ?? 0,
      w: w.w ?? (isDesign && w.type === "divider" ? 12 : 4),
      h: w.h ?? (isDesign ? 1 : 2),
      minW: isDesign ? 1 : 2,
      minH: isDesign ? 1 : 2,
      static: isStatic,
      isDraggable: !isStatic,
      isResizable: !isStatic,
    };
  });

  return (
    <div
      onClick={() => {
        if (!isPreviewMode) selectWidget(null);
      }}
      className="flex flex-col h-full bg-muted/15 select-none"
    >
      {/* ==================================================================== */}
      {/* Header Superior del Constructor                                     */}
      {/* ==================================================================== */}
      <header
        onClick={(e) => e.stopPropagation()}
        className="h-14 border-b border-border/80 bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-30"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              {dashboard.name}
            </h1>
            {isPreviewMode ? (
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200/80 font-medium dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5" />
                Vista Previa
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] bg-amber-50 text-amber-700 border-amber-200/80 font-medium dark:bg-amber-950/40 dark:text-amber-300"
              >
                Modo Edición
              </Badge>
            )}
            {dashboard.section && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {dashboard.section.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPreviewMode ? (
            <Button
              size="sm"
              onClick={togglePreviewMode}
              className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
            >
              <Pencil className="size-3.5" />
              <span>Volver a Edición</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddEmptyVisual}
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Añadir visual</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSaveLayout}
                disabled={isPending}
                className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
              >
                <Save className="size-3.5" />
                <span>{isPending ? "Guardando..." : "Guardar Diseño"}</span>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ==================================================================== */}
      {/* Contenedor Principal: Lienzo Interactivo + Panel de Propiedades        */}
      {/* ==================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Columna del Lienzo con Toolbar Sticky encima */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Barra de Herramientas Sticky Encima del Lienzo (solo en modo edición) */}
          {!isPreviewMode && <EditorToolbar dashboardId={dashboard.id} canvasRef={canvasRef} />}

          {/* Lienzo de Cuadrícula con scroll propio */}
          <div
            ref={canvasRef}
            className="flex-1 p-6 overflow-y-auto"
          >
            <CrossFilterChip />
            <div
              ref={containerRef}
              className={cn(
                "w-full min-h-[500px] origin-top-left rounded-xl transition-all",
                isGridVisible && "bg-grid-active"
              )}
              style={{
                transform: `scale(${zoom / 100})`,
                width: zoom < 100 ? `${100 / (zoom / 100)}%` : "100%",
                ...(isGridVisible
                  ? {
                      backgroundImage: `
                        linear-gradient(to right, rgba(148, 163, 184, 0.16) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(148, 163, 184, 0.16) 1px, transparent 1px)
                      `,
                      backgroundSize: `calc((100% - 16px) / 12) 96px`,
                      backgroundPosition: `16px 16px`,
                    }
                  : undefined),
              }}
              id="dashboard-canvas-grid"
            >
              {widgets.length === 0 ? (
                <div className="border-2 border-dashed border-border/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-card/40 my-8">
                  <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Sliders className="size-7" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Lienzo de edición vacío
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mb-4">
                    Comienza a construir este tablero agregando visuales interactivos estilo Power BI
                    (tarjetas KPI, barras, líneas, tablas y donas).
                  </p>
                  <Button
                    size="sm"
                    onClick={handleAddEmptyVisual}
                    className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Añadir Primer Visual</span>
                  </Button>
                </div>
              ) : mounted ? (
                <ReactGridLayout
                  layout={layoutItems}
                  width={width}
                  gridConfig={{
                    cols: 12,
                    rowHeight: 80,
                    margin: [16, 16],
                    containerPadding: [16, 16],
                  }}
                  dragConfig={{
                    enabled: !isPreviewMode,
                    handle: ".drag-handle",
                    bounded: true,
                  }}
                  resizeConfig={{
                    enabled: !isPreviewMode,
                  }}
                  onLayoutChange={handleLayoutChange}
                  onDragStart={() => {
                    isInteractingRef.current = true;
                  }}
                  onDragStop={(newLayout: readonly any[], _oldItem: any, newItem: any) => {
                    handleCommitMove(newLayout, newItem);
                  }}
                  onResizeStart={() => {
                    isInteractingRef.current = true;
                  }}
                  onResizeStop={(newLayout: readonly any[], _oldItem: any, newItem: any) => {
                    handleCommitMove(newLayout, newItem);
                  }}
                >
                  {widgets.map((widget) => {
                    const isSelected =
                      (selectedWidgetIds.includes(widget.id) || selectedWidgetId === widget.id) &&
                      !isPreviewMode;
                    const isLocked = Boolean(widget.config.layout?.locked);
                    const groupId = (widget.config as Record<string, unknown>).groupId;
                    const isDesignWidget =
                      widget.type === "text" ||
                      widget.type === "divider" ||
                      widget.type === "image" ||
                      (widget.config as Record<string, unknown>)?.visualType === "text" ||
                      (widget.config as Record<string, unknown>)?.visualType === "divider" ||
                      (widget.config as Record<string, unknown>)?.visualType === "image";

                    const badgeLabel =
                      widget.type === "text" || (widget.config as Record<string, unknown>)?.visualType === "text"
                        ? "Texto"
                        : widget.type === "divider" || (widget.config as Record<string, unknown>)?.visualType === "divider"
                          ? "Línea"
                          : widget.type === "image" || (widget.config as Record<string, unknown>)?.visualType === "image"
                            ? "Imagen"
                            : widget.config.visualType || widget.type;

                    return (
                      <div
                        key={widget.id}
                        id={`widget-card-${widget.id}`}
                        data-widget-id={widget.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isPreviewMode) {
                            const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
                            selectWidget(widget.id, isMulti);
                          }
                        }}
                        className={cn(
                          "group rounded-xl transition-all flex flex-col overflow-hidden",
                          isDesignWidget
                            ? "bg-transparent border-none shadow-none"
                            : "border border-border bg-card shadow-xs hover:border-border/80",
                          isSelected && (isDesignWidget ? "ring-1 ring-primary/40 rounded-lg" : "ring-2 ring-primary/40 shadow-md")
                        )}
                      >
                        {/* Cabecera del Widget con Drag Handle, Bloqueo y Botón de Borrar (solo en edición) */}
                        {!isPreviewMode && (
                          <div
                            className={cn(
                              "widget-drag-header h-7 px-2.5 flex items-center justify-between shrink-0 transition-opacity",
                              isDesignWidget
                                ? "opacity-0 group-hover:opacity-100 bg-background/90 backdrop-blur-xs border-b border-border/40 rounded-t-lg"
                                : "opacity-40 group-hover:opacity-100 bg-muted/40 border-b border-border/60"
                            )}
                          >
                            <div
                              className={cn(
                                "drag-handle flex items-center gap-1.5 text-muted-foreground text-xs py-1",
                                isLocked
                                  ? "cursor-default opacity-60"
                                  : "hover:text-foreground cursor-grab active:cursor-grabbing"
                              )}
                            >
                              <GripHorizontal className="size-3.5" />
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase font-mono px-1 py-0 h-4 font-semibold text-muted-foreground bg-background/50"
                              >
                                {badgeLabel}
                              </Badge>
                              {Boolean(groupId) && (
                                <Badge
                                  variant="secondary"
                                  className="text-[8px] uppercase font-mono px-1 py-0 h-3.5 bg-primary/10 text-primary font-semibold"
                                >
                                  Grupo
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLockWidget(widget.id);
                                }}
                                className={cn(
                                  "size-5 rounded cursor-pointer",
                                  isLocked
                                    ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                                title={
                                  isLocked
                                    ? "Visual bloqueado. Clic para desbloquear"
                                    : "Bloquear visual"
                                }
                              >
                                {isLocked ? (
                                  <Lock className="size-3 text-amber-500" />
                                ) : (
                                  <Unlock className="size-3 opacity-60" />
                                )}
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon-xs"
                                disabled={isLocked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isLocked) removeWidget(widget.id);
                                }}
                                className={cn(
                                  "size-5 rounded cursor-pointer",
                                  isLocked
                                    ? "opacity-30 cursor-not-allowed"
                                    : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                )}
                                title={
                                  isLocked
                                    ? "Desbloquea el visual para eliminarlo"
                                    : "Eliminar visual"
                                }
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Contenido Visual Dinámico */}
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <WidgetRenderer
                            widget={widget}
                            isSelected={isSelected}
                            onSelect={() => {
                              if (!isPreviewMode) selectWidget(widget.id);
                            }}
                            isEditMode={!isPreviewMode}
                            isShareMode={isShareMode}
                          />
                        </div>
                      </div>
                    );
                  })}
                </ReactGridLayout>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                  Cargando cuadrícula...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel Fijo Derecho de Propiedades estilo Power BI (solo en modo edición) */}
        {!isPreviewMode && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 h-full">
            <PropertiesPanel />
          </div>
        )}
      </div>
    </div>
  );
}
