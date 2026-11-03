import React from "react";
import {
  LayoutDashboard,
  Sparkles,
  BarChart3,
  TrendingUp,
  FolderOpen,
  PlusCircle,
  Layers,
} from "lucide-react";
import {
  getSections,
  getDashboards,
  getDashboardById,
} from "@/lib/services/dashboard.service";
import { DashboardSidebar } from "@/components/dashboards/DashboardSidebar";
import { DashboardCanvasActions } from "@/components/dashboards/DashboardCanvasActions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface DashboardsPageProps {
  searchParams?: Promise<{ id?: string }>;
}

export default async function DashboardsPage(props: DashboardsPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const currentId = searchParams?.id;

  // Consulta dinámica en Prisma Server-Side
  const [sections, dashboards] = await Promise.all([
    getSections().catch(() => []),
    getDashboards().catch(() => []),
  ]);

  // Si hay un tablero seleccionado en la URL, consultamos su detalle completo
  const activeDashboard = currentId
    ? await getDashboardById(currentId).catch(() => null)
    : null;

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden">
      {/* 1. Sidebar Dinámico Izquierdo con datos de Prisma */}
      <DashboardSidebar sections={sections} dashboards={dashboards} />

      {/* 2. Área Principal (Canvas de Trabajo) */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-muted/15">
        {activeDashboard ? (
          // Vista cuando hay un tablero seleccionado
          <div className="flex flex-col h-full">
            {/* Barra de título del tablero activo */}
            <div className="h-14 border-b border-border/80 bg-background/50 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <LayoutDashboard className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-semibold tracking-tight text-foreground">
                      {activeDashboard.name}
                    </h1>
                    {activeDashboard.section && (
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {activeDashboard.section.name}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4.5 px-2 font-medium ${
                        activeDashboard.isPublished
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
                          : "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
                      }`}
                    >
                      {activeDashboard.isPublished ? "Publicado" : "Borrador"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Creado el{" "}
                    {new Date(activeDashboard.createdAt).toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Acciones del Canvas */}
              <DashboardCanvasActions />
            </div>

            {/* Lienzo en blanco para los widgets (Área del constructor) */}
            <div className="flex-1 p-6 flex flex-col">
              <div className="flex-1 min-h-[400px] border-2 border-dashed border-border/70 rounded-xl bg-card/30 flex flex-col items-center justify-center text-center p-8 transition-colors hover:border-border">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-xs">
                  <BarChart3 className="size-7" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">
                  Lienzo de widgets listo
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
                  Este tablero no contiene widgets configurados todavía. Aquí es donde
                  podrás arrastrar y soltar tus indicadores clave, gráficos de ventas y
                  tablas de control.
                </p>
                <DashboardCanvasActions />
              </div>
            </div>
          </div>
        ) : (
          // Vista por defecto: Mensaje de bienvenida / Canvas en blanco
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-md w-full space-y-6">
              {/* Icono de Bienvenida estilo Odoo */}
              <div className="relative mx-auto size-20 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center shadow-sm">
                <Sparkles className="size-9 text-primary" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Selecciona un tablero para comenzar
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Explora las secciones del panel lateral para visualizar métricas,
                  o crea un nuevo tablero para organizar los KPIs de tu pollería.
                </p>
              </div>

              {/* Tarjetas informativas de acceso rápido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 transition-all">
                  <div className="flex items-center gap-2 mb-1.5 text-primary">
                    <TrendingUp className="size-4" />
                    <span className="text-xs font-semibold text-foreground">
                      Métricas en Tiempo Real
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Supervisa ventas del día, pedidos KDS, comandas de mesas y stock crítico.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 transition-all">
                  <div className="flex items-center gap-2 mb-1.5 text-primary">
                    <Layers className="size-4" />
                    <span className="text-xs font-semibold text-foreground">
                      Organizado por Secciones
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Agrupa tus vistas estratégicas en Salón, Cocina, Caja, Almacén y Finanzas.
                  </p>
                </div>
              </div>

              {sections.length > 0 && (
                <div className="pt-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <FolderOpen className="size-3.5" />
                  <span>
                    {sections.length} {sections.length === 1 ? "sección disponible" : "secciones disponibles"} en el panel lateral
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
