import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Sliders,
  RefreshCw,
  PlusCircle,
  BarChart3,
} from "lucide-react";
import {
  getSections,
  getDashboards,
  getDashboardById,
} from "@/lib/services/settings/dashboard.service";
import { DashboardSidebar } from "@/components/dashboards/DashboardSidebar";
import { WidgetRenderer } from "@/components/dashboards/WidgetRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface DashboardDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DashboardDetailPage(props: DashboardDetailPageProps) {
  const { id } = await props.params;

  const [sections, dashboards, dashboard] = await Promise.all([
    getSections().catch(() => []),
    getDashboards().catch(() => []),
    getDashboardById(id).catch(() => null),
  ]);

  if (!dashboard) {
    notFound();
  }

  const widgets = dashboard.widgets || [];

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden">
      {/* 1. Sidebar Dinámico Izquierdo */}
      <DashboardSidebar sections={sections} dashboards={dashboards} />

      {/* 2. Área Principal de Lectura Estática (Reporte Final) */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-muted/15 select-none">
        {/* Barra superior de información del Tablero */}
        <header className="h-14 border-b border-border/80 bg-background/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <LayoutDashboard className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  {dashboard.name}
                </h1>
                {dashboard.section && (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {dashboard.section.name}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] h-4.5 px-2 font-medium ${
                    dashboard.isPublished
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
                      : "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
                  }`}
                >
                  {dashboard.isPublished ? "Publicado" : "Borrador"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Creado el{" "}
                {new Date(dashboard.createdAt).toLocaleDateString("es-PE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Acciones de Lectura / Navegar a Modo Edición */}
          <div className="flex items-center gap-2">
            <Link href={`/dashboards/${dashboard.id}/edit`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
              >
                <Sliders className="size-3.5" />
                <span>Editar diseño</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* ==================================================================== */}
        {/* Vista de Cuadrícula Estática (CSS Grid Puro - Sin react-grid-layout) */}
        {/* ==================================================================== */}
        <div className="flex-1 p-6">
          {widgets.length === 0 ? (
            /* Estado Vacío cuando aún no tiene widgets */
            <div className="min-h-[420px] border-2 border-dashed border-border/70 rounded-2xl bg-card/30 flex flex-col items-center justify-center text-center p-8 transition-colors">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-xs">
                <BarChart3 className="size-7" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                Lienzo de widgets listo
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
                Este tablero no contiene widgets configurados todavía. Pasa al modo
                de edición interactivo para arrastrar y soltar tus indicadores clave,
                gráficos de ventas y tablas de control.
              </p>

              <Link href={`/dashboards/${dashboard.id}/edit`}>
                <Button size="sm" className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-xs">
                  <Sliders className="size-3.5" />
                  <span>Configurar Widgets</span>
                </Button>
              </Link>
            </div>
          ) : (
            /* Renderizado Estático usando 12 Columnas en CSS Grid */
            <div
              className="grid gap-4 w-full"
              style={{
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gridAutoRows: "80px",
              }}
            >
              {widgets.map((widget) => {
                const colStart = (widget.x ?? 0) + 1;
                const colSpan = widget.w ?? 4;
                const rowStart = (widget.y ?? 0) + 1;
                const rowSpan = widget.h ?? 2;

                return (
                  <div
                    key={widget.id}
                    className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col"
                    style={{
                      gridColumn: `${colStart} / span ${colSpan}`,
                      gridRow: `${rowStart} / span ${rowSpan}`,
                    }}
                  >
                    <WidgetRenderer widget={widget} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
