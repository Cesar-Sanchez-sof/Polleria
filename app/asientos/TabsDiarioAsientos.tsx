"use client";

import { Button } from "@/components/ui/button";
import type { OpcionDiario } from "@/lib/services/asientos.service";

interface Props {
  diarios: OpcionDiario[];
  /** Total de asientos del listado actual (con los filtros aplicados). */
  total: number;
  /** Diario seleccionado ("todos" = sin filtro). */
  diario: string;
  onSeleccionar: (diario: string) => void;
}

/** Tabs de diario contable: filtro rápido con el conteo de cada diario. */
export function TabsDiarioAsientos({ diarios, total, diario, onSeleccionar }: Readonly<Props>) {
  const tabs = [
    { valor: "todos", etiqueta: "Todos los diarios", total },
    ...diarios.map((d) => ({ valor: d.nombre, etiqueta: d.nombre, total: d.total })),
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const activo = diario === tab.valor;
        return (
          <Button
            key={tab.valor}
            variant="ghost"
            onClick={() => onSeleccionar(tab.valor)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto shrink-0 ${
              activo
                ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            type="button"
          >
            {tab.etiqueta} ({tab.total})
          </Button>
        );
      })}
    </div>
  );
}
