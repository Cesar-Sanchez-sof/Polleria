import React, { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboards/DashboardHeader";

export const metadata = {
  title: "Tableros | ERP Pollería",
  description: "Módulo de Tableros, Reportes y KPIs interactivos",
};

export default function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen max-h-screen w-full bg-background overflow-hidden">
      {/* Barra de Navegación Superior (Header) */}
      <Suspense
        fallback={
          <header className="relative z-50 h-14 border-b border-border bg-card/60 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-md bg-muted animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
          </header>
        }
      >
        <DashboardHeader />
      </Suspense>

      {/* Contenedor del Módulo (Sidebar + Canvas / Configuración) */}
      <div className="flex flex-1 w-full overflow-hidden relative z-0">
        {children}
      </div>
    </div>
  );
}
