"use client";

import React, { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import { useDashboardCatalog } from "@/lib/hooks/use-visual-data";

export function CrossFilterChip() {
  const crossFilters = useDashboardEditorStore((s) => s.crossFilters);
  const clearCrossFilters = useDashboardEditorStore((s) => s.clearCrossFilters);
  const { catalog } = useDashboardCatalog();

  // Esc para quitar el filtro cruzado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && crossFilters) {
        const activeEl = document.activeElement as HTMLElement | null;
        const isInput =
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable);
        if (isInput) return;

        const hasOpenDialog = Boolean(
          document.querySelector(
            '[role="dialog"], [role="alertdialog"], [data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]'
          )
        );
        if (hasOpenDialog) return;

        clearCrossFilters();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [crossFilters, clearCrossFilters]);

  if (!crossFilters) return null;

  const dataset = catalog.find((ds) => ds.id === crossFilters.datasetId);
  const field = dataset?.fields.find((f) => f.id === crossFilters.field);
  const fieldLabel = field?.label || crossFilters.field;

  return (
    <div className="flex items-center gap-2 mb-3 select-none">
      <Badge
        variant="secondary"
        className="h-7 px-3 text-xs font-normal flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 shadow-xs cursor-pointer hover:bg-primary/20 transition-colors"
        onClick={clearCrossFilters}
        title="Clic o presiona Esc para quitar el filtro cruzado"
      >
        <span>
          Filtro: <strong className="font-semibold">{fieldLabel}</strong> = {crossFilters.display}
        </span>
        <span
          className="ml-1 text-sm font-bold text-primary/70 hover:text-primary transition-colors leading-none"
          aria-label="Quitar filtro"
        >
          ×
        </span>
      </Badge>
    </div>
  );
}
