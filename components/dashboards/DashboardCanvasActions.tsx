"use client";

import React from "react";
import { Plus, SlidersHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DashboardCanvasActions() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info("Actualizando datos del tablero...")}
        className="h-8 gap-1.5 text-xs cursor-pointer"
      >
        <RefreshCw className="size-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">Actualizar</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info("Filtros de período y sucursal (próximamente)")}
        className="h-8 gap-1.5 text-xs cursor-pointer"
      >
        <SlidersHorizontal className="size-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">Filtros</span>
      </Button>

      <Button
        size="sm"
        onClick={() =>
          toast.info(
            "Constructor de widgets: Aquí podrás arrastrar y soltar tus KPIs y gráficos."
          )
        }
        className="h-8 gap-1.5 text-xs cursor-pointer shadow-xs"
      >
        <Plus className="size-3.5" />
        <span>Añadir Widget</span>
      </Button>
    </div>
  );
}
