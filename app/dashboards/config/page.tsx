import React from "react";
import Link from "next/link";
import {
  Layers,
  LayoutDashboard,
  Link2,
  Plus,
  ArrowLeft,
  Settings,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSections, getDashboards } from "@/lib/services/dashboard.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configuración de Tableros | ERP Pollería",
  description: "Administración de secciones, permisos y enlaces compartidos de tableros",
};

export default async function DashboardConfigPage() {
  const [sections, dashboards] = await Promise.all([
    getSections().catch(() => []),
    getDashboards().catch(() => []),
  ]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-muted/10 p-6 md:p-8">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Cabecera de la página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboards"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span>Volver a Tableros</span>
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Settings className="size-6 text-primary" />
              Configuración de Tableros
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Gestiona las secciones, permisos de acceso y enlaces compartidos del módulo de Business Intelligence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboards">
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
                <LayoutDashboard className="size-4" />
                <span>Ver Tableros</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Tarjetas de Configuración */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. SECCIONES */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Secciones</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Agrupa los tableros en categorías operativas (Ventas, Finanzas, Cocina, Compras) y define el orden de presentación.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {sections.length} {sections.length === 1 ? "sección creada" : "secciones creadas"}
              </span>
              <Button size="xs" variant="secondary" className="text-xs">
                Administrar
              </Button>
            </div>
          </div>

          {/* 2. TABLEROS Y PERMISOS */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <LayoutDashboard className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Tableros</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Administra el estado de publicación, control de acceso por roles y usuarios autorizados para cada vista.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {dashboards.length} {dashboards.length === 1 ? "tablero total" : "tableros totales"}
              </span>
              <Button size="xs" variant="secondary" className="text-xs">
                Gestionar
              </Button>
            </div>
          </div>

          {/* 3. ENLACES COMPARTIDOS */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Link2 className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Enlaces Compartidos</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Supervisa y revoca tokens de enlaces públicos generados para compartir reportes con gerencia o socios.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Tokens UUID
              </span>
              <Button size="xs" variant="secondary" className="text-xs">
                Ver Enlaces
              </Button>
            </div>
          </div>
        </div>

        {/* Resumen de Secciones Actuales */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4.5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Secciones configuradas en la base de datos
              </h3>
            </div>
            <Button size="xs" variant="outline" className="gap-1 text-xs">
              <Plus className="size-3.5" />
              <span>Nueva Sección</span>
            </Button>
          </div>

          {sections.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">
              No hay secciones creadas todavía.
            </p>
          ) : (
            <div className="divide-y divide-border/60 border rounded-lg overflow-hidden">
              {sections.map((sec) => {
                const count = dashboards.filter((d) => d.sectionId === sec.id).length;
                return (
                  <div
                    key={sec.id}
                    className="p-3 bg-background flex items-center justify-between hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-6">
                        #{sec.order}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {sec.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {count} {count === 1 ? "tablero" : "tableros"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
