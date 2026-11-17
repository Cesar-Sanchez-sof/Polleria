"use client";

import React from "react";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";

/**
 * Botón flotante que aparece en la vista de lectura cuando hay filtros cruzados activos.
 * Se ubica en la esquina inferior derecha del viewport.
 */
export function CrossFilterClearButton() {
  const crossFilters = useDashboardEditorStore((s) => s.crossFilters);
  const clearCrossFilters = useDashboardEditorStore((s) => s.clearCrossFilters);

  const hasCrossFilters = Boolean(crossFilters && Object.keys(crossFilters).length > 0);

  if (!hasCrossFilters) return null;

  const filterCount = crossFilters ? Object.keys(crossFilters).length : 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <Button
        size="sm"
        onClick={clearCrossFilters}
        className="h-9 gap-2 text-xs font-semibold shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
        title="Limpiar todos los filtros cruzados activos"
      >
        <FilterX className="size-3.5" />
        <span>
          Limpiar {filterCount === 1 ? "filtro" : `${filterCount} filtros`}
        </span>
      </Button>
    </div>
  );
}
