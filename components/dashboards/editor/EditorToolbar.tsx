"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Undo2,
  Redo2,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Grid3X3,
  AlignVerticalJustifyStart,
  Maximize2,
  RefreshCw,
  Eye,
  FilterX,
  Type,
  Minus,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalDistributeCenter,
  Group,
  Ungroup,
  ClipboardPaste,
  ZoomIn,
  ZoomOut,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DynamicVisual } from "../visuals/DynamicVisual";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { useVisualData } from "@/lib/hooks/use-visual-data";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  dashboardId: string;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  active = false,
  className,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "size-7 rounded-md text-foreground transition-colors cursor-pointer",
              active
                ? "bg-muted text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
              disabled && "opacity-40 cursor-not-allowed",
              className
            )}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent side="bottom" sideOffset={6} className="text-xs py-1 px-2 flex items-center gap-1.5">
        <span>{label}</span>
        {shortcut && (
          <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Data Inspector Sheet ─────────────────────────────────────────────────────
function DataInspectorSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const selectedWidget = useDashboardEditorStore((s) => s.getSelectedWidget());
  const { data, isLoading } = useVisualData(
    selectedWidget?.config.data ?? { dataset: "", values: [] }
  );

  const rows = data?.rows ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Table2 className="size-4 text-primary" />
            Inspección de Datos
            {selectedWidget && (
              <Badge variant="secondary" className="text-[10px] font-mono ml-1">
                {selectedWidget.title || selectedWidget.config.visualType}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 py-3">
          {!selectedWidget ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Selecciona un visual en el lienzo para inspeccionar sus datos.
            </p>
          ) : isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Cargando datos…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Sin datos — configura el widget o comprueba el filtro activo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="border-b border-border/80 bg-muted/40 text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-muted/30 transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="border-b border-border/40 px-2 py-1 text-foreground/90 whitespace-nowrap"
                        >
                          {String((row as Record<string, unknown>)[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-2">
                {rows.length} filas devueltas por la consulta.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Insert Image Dialog ──────────────────────────────────────────────────────
function InsertImageDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  const handleInsert = () => {
    if (!url.trim()) return;
    onInsert(url.trim());
    setUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            Insertar Imagen
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          <label className="text-xs font-medium text-muted-foreground">URL de la imagen</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
            placeholder="https://ejemplo.com/imagen.png"
            className="w-full h-9 text-xs rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs cursor-pointer"
              onClick={() => { setUrl(""); onOpenChange(false); }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs cursor-pointer"
              onClick={handleInsert}
              disabled={!url.trim()}
            >
              Insertar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────
export function EditorToolbar({ dashboardId, canvasRef }: EditorToolbarProps) {
  void dashboardId;
  void canvasRef;
  const { mutate } = useSWRConfig();

  const {
    selectedWidgetId,
    selectedWidgetIds,
    getSelectedWidget,
    canUndo,
    canRedo,
    undo,
    redo,
    duplicateWidget,
    removeWidget,
    toggleLockWidget,
    isGridVisible,
    toggleGrid,
    autoFitWidgets,
    isDirty,
    isRefreshing,
    setIsRefreshing,
    togglePreviewMode,
    crossFilters,
    clearCrossFilters,
    addTextWidget,
    addDividerWidget,
    addImageWidget,
    alignLeft,
    alignCenter,
    alignRight,
    distributeHorizontally,
    groupSelectedWidgets,
    ungroupSelectedWidgets,
    copySelectedWidgets,
    pasteWidgets,
    clipboard,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useDashboardEditorStore();

  const hasCrossFilters = Boolean(crossFilters);
  const selectedWidget = getSelectedWidget();
  const isSelectedLocked = Boolean(selectedWidget?.config.layout?.locked);
  const multiSelected = selectedWidgetIds.length >= 2;

  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  // =========================================================================
  // Atajos de teclado: Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Supr, Ctrl+D
  // =========================================================================
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.isContentEditable);

      if (isInput) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      if (
        (isCtrlOrCmd && e.key.toLowerCase() === "y") ||
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (e.key === "Delete") {
        if (selectedWidgetId && !isSelectedLocked) {
          e.preventDefault();
          removeWidget(selectedWidgetId);
        }
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === "d") {
        if (selectedWidgetId) {
          e.preventDefault();
          duplicateWidget(selectedWidgetId);
        }
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelectedWidgets();
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteWidgets();
        return;
      }
    },
    [canUndo, canRedo, undo, redo, selectedWidgetId, isSelectedLocked, removeWidget,
      duplicateWidget, copySelectedWidgets, pasteWidgets]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutate(
        (key) => {
          if (typeof key === "string") return key.includes("/api/dashboards/query");
          if (Array.isArray(key)) {
            return key.some(
              (k) => typeof k === "string" && k.includes("/api/dashboards/query")
            );
          }
          return false;
        },
        undefined,
        { revalidate: true }
      );
      toast.success("Consultas de datos revalidadas exitosamente");
    } catch {
      toast.error("Error al actualizar consultas de datos");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <TooltipProvider delay={250}>
      <nav
        aria-label="Barra de herramientas del editor"
        className="sticky top-0 z-20 w-full border-b border-border bg-card text-foreground px-4 py-1.5 flex items-center justify-between shadow-xs select-none overflow-x-auto"
      >
        <div className="flex items-center gap-1 flex-nowrap">

          {/* 1. Historial */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Undo2 className="size-4" />}
              label="Deshacer"
              shortcut="Ctrl+Z"
              onClick={undo}
              disabled={!canUndo}
            />
            <ToolbarButton
              icon={<Redo2 className="size-4" />}
              label="Rehacer"
              shortcut="Ctrl+Y"
              onClick={redo}
              disabled={!canRedo}
            />
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 2. Insertar */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Type className="size-4" />}
              label="Insertar Texto"
              onClick={() => { addTextWidget(); toast.success("Widget de texto añadido"); }}
            />
            <ToolbarButton
              icon={<Minus className="size-4" />}
              label="Insertar Separador"
              onClick={() => { addDividerWidget(); toast.success("Separador añadido"); }}
            />
            <ToolbarButton
              icon={<ImageIcon className="size-4" />}
              label="Insertar Imagen"
              onClick={() => setIsImageDialogOpen(true)}
            />
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 3. Visual */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Copy className="size-4" />}
              label="Duplicar visual"
              shortcut="Ctrl+D"
              onClick={() => duplicateWidget()}
              disabled={!selectedWidgetId}
            />
            <ToolbarButton
              icon={<Copy className="size-4 scale-x-[-1]" />}
              label="Copiar"
              shortcut="Ctrl+C"
              onClick={() => { copySelectedWidgets(); toast.success("Copiado al portapapeles"); }}
              disabled={!selectedWidgetId}
            />
            <ToolbarButton
              icon={<ClipboardPaste className="size-4" />}
              label="Pegar"
              shortcut="Ctrl+V"
              onClick={() => pasteWidgets()}
              disabled={clipboard.length === 0}
            />
            <ToolbarButton
              icon={<Trash2 className="size-4" />}
              label={isSelectedLocked ? "Visual bloqueado" : "Eliminar visual"}
              shortcut="Supr"
              onClick={() => selectedWidgetId && removeWidget(selectedWidgetId)}
              disabled={!selectedWidgetId || isSelectedLocked}
            />
            <ToolbarButton
              icon={
                isSelectedLocked ? (
                  <Lock className="size-4 text-amber-500" />
                ) : (
                  <Unlock className="size-4" />
                )
              }
              label={isSelectedLocked ? "Desbloquear posición" : "Bloquear posición"}
              onClick={() => toggleLockWidget()}
              disabled={!selectedWidgetId}
              active={isSelectedLocked}
            />
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 4. Alinear (sólo con selección múltiple) */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<AlignLeft className="size-4" />}
              label="Alinear izquierda"
              onClick={() => { alignLeft(); }}
              disabled={!multiSelected}
            />
            <ToolbarButton
              icon={<AlignCenter className="size-4" />}
              label="Alinear centro"
              onClick={() => { alignCenter(); }}
              disabled={!multiSelected}
            />
            <ToolbarButton
              icon={<AlignRight className="size-4" />}
              label="Alinear derecha"
              onClick={() => { alignRight(); }}
              disabled={!multiSelected}
            />
            <ToolbarButton
              icon={<AlignHorizontalDistributeCenter className="size-4" />}
              label="Distribuir horizontalmente"
              onClick={() => { distributeHorizontally(); }}
              disabled={selectedWidgetIds.length < 3}
            />
            <Separator orientation="vertical" className="h-4 mx-0.5" />
            <ToolbarButton
              icon={<Group className="size-4" />}
              label="Agrupar selección"
              onClick={() => { groupSelectedWidgets(); toast.success("Widgets agrupados"); }}
              disabled={!multiSelected}
            />
            <ToolbarButton
              icon={<Ungroup className="size-4" />}
              label="Desagrupar"
              onClick={() => { ungroupSelectedWidgets(); toast.success("Widgets desagrupados"); }}
              disabled={!selectedWidgetId}
            />
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 5. Lienzo */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Grid3X3 className="size-4" />}
              label="Cuadrícula guía"
              onClick={toggleGrid}
              active={isGridVisible}
            />
            <ToolbarButton
              icon={<AlignVerticalJustifyStart className="size-4" />}
              label="Auto-ajustar widgets"
              onClick={autoFitWidgets}
            />
            <ToolbarButton
              icon={<Maximize2 className="size-4" />}
              label="Modo enfoque"
              shortcut="Esc para cerrar"
              onClick={() => setIsFocusOpen(true)}
              disabled={!selectedWidgetId}
            />
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 6. Zoom */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<ZoomOut className="size-4" />}
              label="Alejar"
              onClick={zoomOut}
              disabled={zoom <= 50}
            />
            <button
              onClick={resetZoom}
              className="text-[11px] font-mono px-1.5 h-7 rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-w-[42px] text-center"
              title="Restablecer zoom al 100%"
            >
              {zoom}%
            </button>
            <ToolbarButton
              icon={<ZoomIn className="size-4" />}
              label="Acercar"
              onClick={zoomIn}
              disabled={zoom >= 150}
            />
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 7. Datos */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={
                <RefreshCw
                  className={cn(
                    "size-4 transition-transform",
                    isRefreshing && "animate-spin text-primary"
                  )}
                />
              }
              label="Actualizar datos"
              onClick={handleRefresh}
              disabled={isRefreshing}
            />
            <ToolbarButton
              icon={<Table2 className="size-4" />}
              label="Inspeccionar datos"
              onClick={() => setIsDataOpen(true)}
              disabled={!selectedWidgetId}
            />
            {hasCrossFilters && (
              <ToolbarButton
                icon={<FilterX className="size-4 text-primary" />}
                label="Limpiar filtros cruzados"
                onClick={clearCrossFilters}
                active
              />
            )}
          </div>
        </div>

        {/* 8. Estado */}
        <div className="flex items-center gap-2.5 ml-2 shrink-0">
          {isDirty ? (
            <Badge
              variant="outline"
              className="text-[11px] h-6 px-2 font-medium bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
            >
              <span className="size-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
              Sin guardar
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[11px] h-6 px-2 font-medium bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5" />
              Guardado
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={togglePreviewMode}
            className="h-7 text-xs gap-1.5 cursor-pointer hover:bg-muted"
            title="Activar vista previa (Lectura)"
          >
            <Eye className="size-3.5" />
            <span>Lectura</span>
          </Button>
        </div>
      </nav>

      {/* Dialog Enfoque */}
      <Dialog open={isFocusOpen} onOpenChange={setIsFocusOpen}>
        <DialogContent className="max-w-5xl w-[92vw] h-[85vh] flex flex-col p-6 bg-card text-card-foreground">
          <DialogHeader className="shrink-0 mb-2">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center justify-between">
              <span>
                {selectedWidget?.title ||
                  selectedWidget?.config.format.title.text ||
                  "Enfoque del Visual"}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Presiona <kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> para cerrar
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-border bg-background p-4 flex flex-col">
            {selectedWidget ? (
              <DynamicVisual
                config={selectedWidget.config}
                widgetId={selectedWidget.id}
                isSelected={false}
                isEditMode={false}
              />
            ) : (
              <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
                Ningún visual seleccionado
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet Inspector de Datos */}
      <DataInspectorSheet open={isDataOpen} onOpenChange={setIsDataOpen} />

      {/* Dialog Insertar Imagen */}
      <InsertImageDialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
        onInsert={(url) => {
          addImageWidget(url);
          toast.success("Widget de imagen añadido");
        }}
      />
    </TooltipProvider>
  );
}
