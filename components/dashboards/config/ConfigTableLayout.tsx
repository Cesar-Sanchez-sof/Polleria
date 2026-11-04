"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Copy,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ConfigTableLayoutProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  selectedCount: number;
  onClearSelection: () => void;
  onAction?: (action: "edit" | "duplicate" | "delete") => void;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
  // Paginación
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function ConfigTableLayout({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selectedCount,
  onClearSelection,
  onAction,
  primaryAction,
  children,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ConfigTableLayoutProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node)
      ) {
        setActionsOpen(false);
      }
    }
    if (actionsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [actionsOpen]);

  // Cálculos de Paginación
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 bg-muted/10">
      <div className="flex flex-col flex-1 bg-card rounded-xl border border-border shadow-xs overflow-hidden">
        {/* ==================================================================== */}
        {/* Barra Superior: Filtros / Búsqueda O Estado de Selección */}
        {/* ==================================================================== */}
        <div className="h-14 border-b border-border/80 px-4 flex items-center justify-between gap-3 bg-card/40 shrink-0">
          {selectedCount > 0 ? (
            /* Estado de Selección Activo */
            <div className="flex items-center gap-2 animate-in fade-in-0 duration-150">
              <Button
                variant="secondary"
                size="sm"
                onClick={onClearSelection}
                className="h-8 gap-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              >
                <span>{selectedCount} {selectedCount === 1 ? "seleccionado" : "selecciones"}</span>
                <X className="size-3.5 ml-1" />
              </Button>

              {/* Dropdown Acciones */}
              <div className="relative" ref={actionsRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionsOpen((prev) => !prev)}
                  className="h-8 gap-1 text-xs font-medium cursor-pointer"
                >
                  <span>Acciones</span>
                  <ChevronDown className="size-3.5 opacity-60 ml-0.5" />
                </Button>

                {actionsOpen && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                    {/* EDITAR: Solo visible cuando exactamente 1 fila está seleccionada */}
                    {selectedCount === 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionsOpen(false);
                          onAction?.("edit");
                        }}
                        className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground text-left cursor-pointer transition-colors"
                      >
                        <Edit className="size-3.5 text-muted-foreground" />
                        <span>Editar</span>
                      </button>
                    )}

                    {/* DUPLICAR: Siempre visible (para 1 o más elementos seleccionados) */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        onAction?.("duplicate");
                      }}
                      className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground text-left cursor-pointer transition-colors"
                    >
                      <Copy className="size-3.5 text-muted-foreground" />
                      <span>Duplicar</span>
                    </button>

                    <div className="h-px bg-border my-1" />

                    {/* ELIMINAR: Siempre visible */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        onAction?.("delete");
                      }}
                      className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 text-left cursor-pointer transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Barra de Búsqueda y Filtros en la parte central/izquierda */
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 pl-8 text-xs bg-background/80"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Botón Principal (Nuevo) */}
          <div className="flex items-center gap-2">
            {primaryAction}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* Contenedor de la Tabla */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>

        {/* ==================================================================== */}
        {/* Paginación Inferior (3 Zonas: Izquierda, Centro, Derecha) */}
        {/* ==================================================================== */}
        <div className="h-12 border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground bg-card/60 shrink-0">
          {/* Izquierda: 1 - 10 / Total de filas */}
          <div className="tabular-nums font-medium">
            {totalItems > 0 ? (
              <span>
                {startIndex} - {endIndex} / {totalItems}
              </span>
            ) : (
              <span>0 - 0 / 0</span>
            )}
          </div>

          {/* Centro: Selector Por página: 10, 25, 50 */}
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Por página:</span>
            <div className="flex items-center border rounded-md overflow-hidden bg-background">
              {[10, 25, 50].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    onPageSizeChange(size);
                    onPageChange(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    pageSize === size
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Derecha: Botones de paginación 1, 2, 3... con flechas */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="size-7 rounded-md cursor-pointer disabled:opacity-40"
              title="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 5) return true;
                  return Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages;
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-muted-foreground">…</span>}
                      <Button
                        variant={currentPage === p ? "default" : "outline"}
                        size="icon-xs"
                        onClick={() => onPageChange(p)}
                        className={`size-7 text-xs rounded-md cursor-pointer ${
                          currentPage === p ? "font-bold" : ""
                        }`}
                      >
                        {p}
                      </Button>
                    </React.Fragment>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="size-7 rounded-md cursor-pointer disabled:opacity-40"
              title="Página siguiente"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
