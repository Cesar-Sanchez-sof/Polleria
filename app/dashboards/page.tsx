import React from "react";
import { redirect } from "next/navigation";
import {
  Sparkles,
  TrendingUp,
  FolderOpen,
  Layers,
} from "lucide-react";
import {
  getSections,
  getDashboards,
} from "@/lib/services/dashboard.service";
import { DashboardSidebar } from "@/components/dashboards/DashboardSidebar";

export const dynamic = "force-dynamic";

interface DashboardsPageProps {
  searchParams?: Promise<{ id?: string }>;
}

export default async function DashboardsPage(props: DashboardsPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const currentId = searchParams?.id;

  // Si se envió un id en la query, redirigimos a la ruta dedicada /dashboards/[id]
  if (currentId) {
    redirect(`/dashboards/${currentId}`);
  }

  // Consulta dinámica en Prisma Server-Side
  const [sections, dashboards] = await Promise.all([
    getSections().catch(() => []),
    getDashboards().catch(() => []),
  ]);

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden">
      {/* 1. Sidebar Dinámico Izquierdo con datos de Prisma */}
      <DashboardSidebar sections={sections} dashboards={dashboards} />

      {/* 2. Área Principal: Mensaje de bienvenida / Seleccionar tablero */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/15 select-none overflow-y-auto">
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
                {sections.length} {sections.length === 1 ? "sección disponible" : "secciones disponibles"}
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
