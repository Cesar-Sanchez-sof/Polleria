"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Pie del listado: estado de sincronización y acciones rápidas. */
export function PieAsientos() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-3 text-slate-500 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Diarios sincronizados con SUNAT
        </span>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span className="tabular-nums">Moneda base: Soles Peruanos (PEN)</span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none shadow-none cursor-pointer h-8"
          type="button"
        >
          <Download className="w-4 h-4" />
          <span>Exportar XLSX</span>
        </Button>
        <Button
          variant="outline"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none shadow-none cursor-pointer h-8"
          type="button"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir Libro Diario</span>
        </Button>
      </div>
    </div>
  );
}
