"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  Save,
  ArrowLeft,
  Plus,
  X,
  GripHorizontal,
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  DollarSign,
  Table as TableIcon,
  ShoppingBag,
  Sliders,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { WidgetRenderer, type WidgetData } from "./WidgetRenderer";
import { updateDashboardWidgetsAction } from "@/app/dashboards/config/actions";
import { toast } from "sonner";

interface DashboardCanvasProps {
  dashboard: {
    id: string;
    name: string;
    section?: { name: string } | null;
    isPublished: boolean;
    widgets: any[];
  };
}

interface WidgetTemplate {
  title: string;
  type: "kpi" | "bar" | "line" | "table";
  metricKey: string;
  w: number;
  h: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    title: "Ventas Totales del Día",
    type: "kpi",
    metricKey: "sales_total",
    w: 3,
    h: 2,
    description: "Ingresos monetarios totales registrados hoy",
    icon: DollarSign,
  },
  {
    title: "Pedidos Realizados",
    type: "kpi",
    metricKey: "orders_count",
    w: 3,
    h: 2,
    description: "Conteo total de pedidos atendidos en la jornada",
    icon: ShoppingBag,
  },
  {
    title: "Ticket Promedio",
    type: "kpi",
    metricKey: "avg_ticket",
    w: 3,
    h: 2,
    description: "Promedio facturado por cada mesa o delivery",
    icon: TrendingUp,
  },
  {
    title: "Ocupación de Mesas",
    type: "kpi",
    metricKey: "active_tables",
    w: 3,
    h: 2,
    description: "Mesas ocupadas actualmente en el salón",
    icon: LayoutDashboard,
  },
  {
    title: "Top Platos Más Vendidos",
    type: "bar",
    metricKey: "top_products",
    w: 6,
    h: 4,
    description: "Gráfico de barras comparativo de platos líderes",
    icon: BarChart3,
  },
  {
    title: "Flujo de Ingresos por Hora",
    type: "line",
    metricKey: "hourly_sales",
    w: 6,
    h: 4,
    description: "Curva horaria de ventas para analizar horas punta",
    icon: TrendingUp,
  },
  {
    title: "Últimos Pedidos en Vivo",
    type: "table",
    metricKey: "recent_orders",
    w: 6,
    h: 4,
    description: "Tabla con los pedidos más recientes y sus estados",
    icon: TableIcon,
  },
];

export function DashboardCanvas({ dashboard }: DashboardCanvasProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Medición dinámica de ancho para react-grid-layout
  const { width, containerRef, mounted } = useContainerWidth();

  // Estado local de widgets
  const [widgets, setWidgets] = useState<WidgetData[]>(() => {
    return (dashboard.widgets || []).map((w) => ({
      id: w.id || `w-${Math.random().toString(36).substring(2, 9)}`,
      title: w.title,
      type: w.type,
      metricKey: w.metricKey,
      x: w.x ?? 0,
      y: w.y ?? 0,
      w: w.w ?? 4,
      h: w.h ?? 2,
      config: w.config,
    }));
  });

  // Estado del Sheet lateral de añadir widget
  const [sheetOpen, setSheetOpen] = useState(false);

  // Agregar widget desde plantilla
  const handleAddWidget = (template: WidgetTemplate) => {
    // Calcular posición debajo del último widget o a la derecha
    const maxY = widgets.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 2)), 0);

    const newWidget: WidgetData = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: template.title,
      type: template.type,
      metricKey: template.metricKey,
      x: 0,
      y: maxY,
      w: template.w,
      h: template.h,
    };

    setWidgets((prev) => [...prev, newWidget]);
    toast.success(`Widget "${template.title}" agregado al lienzo`);
    setSheetOpen(false);
  };

  // Eliminar widget
  const handleDeleteWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    toast.info("Widget removido");
  };

  // Sincronizar cambios de posición y tamaño desde react-grid-layout
  const handleLayoutChange = (newLayout: readonly any[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const match = newLayout.find((item) => item.i === widget.id);
        if (match) {
          return {
            ...widget,
            x: match.x,
            y: match.y,
            w: match.w,
            h: match.h,
          };
        }
        return widget;
      })
    );
  };

  // Guardar diseño
  const handleSaveLayout = () => {
    startTransition(async () => {
      const payload = widgets.map((w) => ({
        title: w.title,
        type: w.type,
        metricKey: w.metricKey,
        x: w.x ?? 0,
        y: w.y ?? 0,
        w: w.w ?? 4,
        h: w.h ?? 2,
        config: w.config,
      }));

      const res = await updateDashboardWidgetsAction(dashboard.id, payload);
      if (res.success) {
        toast.success("Diseño del tablero guardado exitosamente");
        router.push(`/dashboards/${dashboard.id}`);
        router.refresh();
      } else {
        toast.error(res.error || "Error al guardar el diseño");
      }
    });
  };

  // Mapeo para react-grid-layout
  const layoutItems = widgets.map((w) => ({
    i: w.id,
    x: w.x ?? 0,
    y: w.y ?? 0,
    w: w.w ?? 4,
    h: w.h ?? 2,
    minW: w.type === "kpi" ? 2 : 3,
    minH: w.type === "kpi" ? 2 : 2,
  }));

  return (
    <div className="flex flex-col h-full bg-muted/15 select-none">
      {/* ==================================================================== */}
      {/* Header Superior del Constructor */}
      {/* ==================================================================== */}
      <header className="h-14 border-b border-border/80 bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href={`/dashboards/${dashboard.id}`}>
            <Button
              variant="outline"
              size="icon-xs"
              className="size-8 rounded-md cursor-pointer hover:bg-muted"
              title="Volver a la vista de lectura"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              {dashboard.name}
            </h1>
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-50 text-amber-700 border-amber-200/80 font-medium dark:bg-amber-950/40 dark:text-amber-300"
            >
              Modo Edición
            </Badge>
            {dashboard.section && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {dashboard.section.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Acciones del Constructor */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
          >
            <Plus className="size-3.5 text-primary" />
            <span>Añadir Widget</span>
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
        </div>
      </header>

      {/* ==================================================================== */}
      {/* Área del Lienzo Interactivo (Grid con react-grid-layout) */}
      {/* ==================================================================== */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div ref={containerRef} className="w-full min-h-[500px]">
          {widgets.length === 0 ? (
            <div className="border-2 border-dashed border-border/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-card/40 my-8">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Sliders className="size-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Lienzo de edición vacío
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mb-4">
                Comienza a construir este tablero agregando widgets de métricas (KPIs),
                gráficos estadísticos de barras o líneas, y tablas de pedidos.
              </p>
              <Button
                size="sm"
                onClick={() => setSheetOpen(true)}
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Añadir Primer Widget</span>
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
              }}
              dragConfig={{
                enabled: true,
                handle: ".drag-handle",
              }}
              resizeConfig={{
                enabled: true,
              }}
              onLayoutChange={handleLayoutChange}
            >
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col group transition-shadow hover:shadow-md hover:border-primary/40"
                >
                  {/* Barra de título del Widget con manija de arrastre y botón X */}
                  <div className="h-8 px-3 border-b border-border/60 bg-muted/40 flex items-center justify-between shrink-0">
                    <div className="drag-handle flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-xs font-semibold text-foreground truncate flex-1 mr-2">
                      <GripHorizontal className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      <span className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                        {widget.type}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteWidget(widget.id)}
                      className="size-5 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground transition-colors cursor-pointer"
                      title="Eliminar widget"
                    >
                      <X className="size-3" />
                    </button>
                  </div>

                  {/* Cuerpo del widget (previsualización del componente visual) */}
                  <div className="flex-1 overflow-hidden pointer-events-none">
                    <WidgetRenderer widget={widget} />
                  </div>
                </div>
              ))}
            </ReactGridLayout>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              Cargando cuadrícula...
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* Panel Lateral (Sheet) para Añadir Widgets */}
      {/* ==================================================================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border/80">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4.5 text-primary" />
              <span>Añadir Widget</span>
            </SheetTitle>
            <SheetDescription className="text-xs">
              Selecciona el tipo de widget que deseas incorporar al diseño de este tablero.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {WIDGET_TEMPLATES.map((tmpl, idx) => {
              const Icon = tmpl.icon;
              return (
                <div
                  key={idx}
                  onClick={() => handleAddWidget(tmpl)}
                  className="p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Icon className="size-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {tmpl.title}
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                        {tmpl.type}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {tmpl.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Tamaño sugerido: {tmpl.w}x{tmpl.h}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
