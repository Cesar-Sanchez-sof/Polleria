"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Star,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Folder,
  Layers,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DashboardSection } from "@prisma/client";
import type { DashboardWithSection } from "@/lib/services/dashboard.service";
import { toast } from "sonner";

interface DashboardSidebarProps {
  sections: DashboardSection[];
  dashboards: DashboardWithSection[];
}

export function DashboardSidebar({ sections, dashboards }: DashboardSidebarProps) {
  const searchParams = useSearchParams();
  const currentId = searchParams.get("id");

  const [search, setSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Estructura de favoritos preparada: por defecto si hay tableros, marcamos el primero como favorito de ejemplo
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (dashboards.length > 0) {
      initial.add(dashboards[0].id);
    }
    return initial;
  });

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info("Removido de favoritos");
      } else {
        next.add(id);
        toast.success("Añadido a favoritos");
      }
      return next;
    });
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Filtrado por buscador
  const filteredDashboards = useMemo(() => {
    if (!search.trim()) return dashboards;
    const query = search.toLowerCase();
    return dashboards.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        d.section?.name.toLowerCase().includes(query)
    );
  }, [dashboards, search]);

  // Tableros favoritos
  const favoriteDashboards = useMemo(() => {
    return filteredDashboards.filter((d) => favoriteIds.has(d.id));
  }, [filteredDashboards, favoriteIds]);

  // Agrupación por sección
  const dashboardsBySection = useMemo(() => {
    const map = new Map<string, DashboardWithSection[]>();
    for (const section of sections) {
      map.set(section.id, []);
    }

    const unassigned: DashboardWithSection[] = [];

    for (const d of filteredDashboards) {
      if (d.sectionId && map.has(d.sectionId)) {
        map.get(d.sectionId)!.push(d);
      } else {
        unassigned.push(d);
      }
    }

    return { map, unassigned };
  }, [sections, filteredDashboards]);

  return (
    <aside className="w-64 sm:w-72 h-full border-r border-border bg-card/40 flex flex-col shrink-0 select-none">
      {/* Barra de Búsqueda y Botón Nuevo */}
      <div className="p-3 space-y-2 border-b border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Vistas y Tableros
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => toast.info("Crear nuevo tablero (próximamente)")}
            title="Crear nuevo tablero"
            className="size-6 rounded-md hover:bg-muted"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tablero..."
            className="h-8 pl-8 text-xs bg-background/80"
          />
        </div>
      </div>

      {/* Lista desplazable de secciones y tableros */}
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-4">
          {/* SECCIÓN ESPECIAL: FAVORITOS */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
              <span>FAVORITOS</span>
              {favoriteDashboards.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto text-[10px] h-4 px-1.5 font-normal"
                >
                  {favoriteDashboards.length}
                </Badge>
              )}
            </div>

            {favoriteDashboards.length === 0 ? (
              <p className="px-3 py-1.5 text-[11px] text-muted-foreground italic">
                {search ? "Sin coincidencias" : "Marca tableros con la estrella para acceso rápido"}
              </p>
            ) : (
              <div className="space-y-0.5">
                {favoriteDashboards.map((d) => {
                  const isActive = currentId === d.id;
                  return (
                    <Link
                      key={`fav-${d.id}`}
                      href={`/dashboards?id=${d.id}`}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium shadow-xs"
                          : "text-foreground hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <LayoutDashboard
                          className={`size-3.5 shrink-0 ${
                            isActive ? "text-primary-foreground" : "text-primary"
                          }`}
                        />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(e, d.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:scale-110 transition-all cursor-pointer"
                        title="Quitar de favoritos"
                      >
                        <Star className="size-3.5 fill-amber-400 text-amber-500" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="my-2" />

          {/* SECCIONES DINÁMICAS (Ventas, Compras, etc.) */}
          {sections.map((section) => {
            const sectionDashboards = dashboardsBySection.map.get(section.id) || [];
            const isCollapsed = collapsedSections[section.id] ?? false;

            return (
              <div key={section.id} className="space-y-1">
                {/* Cabecera de la Sección */}
                <button
                  type="button"
                  onClick={() => toggleSectionCollapse(section.id)}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isCollapsed ? (
                      <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                    )}
                    <Folder className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="truncate uppercase tracking-wider text-[11px]">
                      {section.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums px-1.5 py-0.2 rounded-full bg-muted">
                    {sectionDashboards.length}
                  </span>
                </button>

                {/* Lista de Tableros de la Sección */}
                {!isCollapsed && (
                  <div className="pl-2 space-y-0.5">
                    {sectionDashboards.length === 0 ? (
                      <p className="px-3 py-1.5 text-[11px] text-muted-foreground italic">
                        {search ? "Sin coincidencias" : "Sin tableros en esta sección"}
                      </p>
                    ) : (
                      sectionDashboards.map((d) => {
                        const isActive = currentId === d.id;
                        const isFav = favoriteIds.has(d.id);
                        return (
                          <Link
                            key={d.id}
                            href={`/dashboards?id=${d.id}`}
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground font-medium shadow-xs"
                                : "text-foreground hover:bg-muted/80"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <LayoutDashboard
                                className={`size-3.5 shrink-0 ${
                                  isActive
                                    ? "text-primary-foreground"
                                    : "text-muted-foreground group-hover:text-primary"
                                }`}
                              />
                              <span className="truncate">{d.name}</span>
                              {!d.isPublished && (
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded ${
                                    isActive
                                      ? "bg-primary-foreground/20 text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  Borrador
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(e, d.id)}
                              className={`p-0.5 hover:scale-110 transition-all cursor-pointer ${
                                isFav
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-70 hover:opacity-100"
                              }`}
                              title={isFav ? "Quitar de favoritos" : "Marcar como favorito"}
                            >
                              <Star
                                className={`size-3.5 ${
                                  isFav
                                    ? "fill-amber-400 text-amber-500"
                                    : isActive
                                    ? "text-primary-foreground"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Tableros sin sección asignada */}
          {dashboardsBySection.unassigned.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground">
                <Layers className="size-3.5" />
                <span className="uppercase tracking-wider text-[11px]">OTROS TABLEROS</span>
              </div>
              <div className="pl-2 space-y-0.5">
                {dashboardsBySection.unassigned.map((d) => {
                  const isActive = currentId === d.id;
                  const isFav = favoriteIds.has(d.id);
                  return (
                    <Link
                      key={d.id}
                      href={`/dashboards?id=${d.id}`}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium shadow-xs"
                          : "text-foreground hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <LayoutDashboard
                          className={`size-3.5 shrink-0 ${
                            isActive ? "text-primary-foreground" : "text-muted-foreground"
                          }`}
                        />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(e, d.id)}
                        className={`p-0.5 hover:scale-110 transition-all cursor-pointer ${
                          isFav
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Star
                          className={`size-3.5 ${
                            isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Estado vacío si no hay ninguna sección ni tableros en la base de datos */}
          {sections.length === 0 && dashboards.length === 0 && (
            <div className="px-3 py-6 text-center space-y-2">
              <Sparkles className="size-6 mx-auto text-muted-foreground/60" />
              <p className="text-xs font-medium text-muted-foreground">
                No hay secciones ni tableros creados aún.
              </p>
              <Button
                variant="outline"
                size="xs"
                onClick={() => toast.info("Crear sección desde Configuración")}
                className="text-[11px]"
              >
                Crear Sección
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
