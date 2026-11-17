"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Sliders, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSidebar } from "@/components/dashboards/DashboardSidebar";
import { WidgetRenderer } from "@/components/dashboards/WidgetRenderer";
import { CrossFilterClearButton } from "@/components/dashboards/CrossFilterClearButton";
import { CrossFilterChip } from "@/components/dashboards/CrossFilterChip";
import { DashboardActionBar } from "@/components/dashboards/DashboardActionBar";
import { cn } from "@/lib/utils";

interface DashboardDetailClientViewProps {
  sections: any[];
  dashboards: any[];
  dashboard: any;
  canEdit: boolean;
}

export function DashboardDetailClientView({
  sections,
  dashboards,
  dashboard,
  canEdit,
}: DashboardDetailClientViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const widgets = dashboard.widgets || [];

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden">
      {/* 1. Sidebar Dinámico Izquierdo (Ocultable en Pantalla Completa) */}
      {!isFullscreen && (
        <DashboardSidebar sections={sections} dashboards={dashboards} />
      )}

      {/* 2. Área Principal de Lectura */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-muted/15 select-none">
        {/* Barra superior de información del Tablero (Ocultable en Pantalla Completa) */}
        {!isFullscreen && (
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
              {canEdit && (
                <Link href={`/dashboards/${dashboard.id}/edit`}>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
                  >
                    <Sliders className="size-3.5" />
                    <span>Editar diseño</span>
                  </Button>
                </Link>
              )}
            </div>
          </header>
        )}

        {/* 3. Barra de Acciones y Filtros Globales (Power BI Style) */}
        <DashboardActionBar
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          isFullscreen={isFullscreen}
        />

        {/* 4. Lienzo de Widgets con Patrón de Cuadrícula */}
        <div
          className="flex-1 p-6 transition-all"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px)
            `,
            backgroundSize: `calc((100% - 16px) / 12) 96px`,
            backgroundPosition: `16px 16px`,
          }}
        >
          <CrossFilterChip />

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

              {canEdit && (
                <Link href={`/dashboards/${dashboard.id}/edit`}>
                  <Button size="sm" className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-xs">
                    <Sliders className="size-3.5" />
                    <span>Configurar Widgets</span>
                  </Button>
                </Link>
              )}
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
              {widgets.map((widget: any) => {
                const colStart = (widget.x ?? 0) + 1;
                const colSpan = widget.w ?? 4;
                const rowStart = (widget.y ?? 0) + 1;
                const rowSpan = widget.h ?? 2;

                const isDesignWidget =
                  widget.type === "text" ||
                  widget.type === "divider" ||
                  widget.type === "image";

                return (
                  <div
                    key={widget.id}
                    className={cn(
                      "rounded-xl overflow-hidden flex flex-col",
                      isDesignWidget
                        ? "bg-transparent border-none shadow-none"
                        : "border border-border bg-card shadow-xs"
                    )}
                    style={{
                      gridColumn: `${colStart} / span ${colSpan}`,
                      gridRow: `${rowStart} / span ${rowSpan}`,
                    }}
                  >
                    <WidgetRenderer widget={widget} isEditMode={false} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <CrossFilterClearButton />
    </div>
  );
}
