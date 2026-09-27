"use client";

import { useState } from "react";
import {
  BarChart3,
  Calculator,
  Clock,
  Download,
  Filter,
  Kanban,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** Texto actual del buscador del listado. */
  q: string;
  onBuscar: (valor: string) => void;
  onLimpiarBusqueda: () => void;
  /** Abre el diálogo para registrar un asiento manual. */
  onNuevo: () => void;
  /** Rango de filas visibles de la página actual (ej. 1-10 de 36). */
  desdeMostrado: number;
  hastaMostrado: number;
  total: number;
  cargando: boolean;
  page: number;
  totalPaginas: number;
  onPagina: (pagina: number) => void;
}

/** Barra superior: título, buscador, rango de página y selector de vista. */
export function ToolbarAsientos({
  q,
  onBuscar,
  onLimpiarBusqueda,
  onNuevo,
  desdeMostrado,
  hastaMostrado,
  total,
  cargando,
  page,
  totalPaginas,
  onPagina,
}: Readonly<Props>) {
  const [vista, setVista] = useState<string>("list");

  const vistas = [
    { valor: "list", titulo: "Vista Lista", Icono: List },
    { valor: "kanban", titulo: "Vista Kanban", Icono: Kanban },
    { valor: "schedule", titulo: "Vista Historial / Reloj", Icono: Clock },
    { valor: "chart", titulo: "Vista Gráficos", Icono: BarChart3 },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* LEFT: Title, Settings Icon & New Button */}
      <div className="flex flex-col items-start gap-0">
        <div className="flex justify-start items-center gap-2">
          <Calculator className="w-7 h-7" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Asientos contables</h1>
        </div>
      </div>

      {/* RIGHT: Odoo Style Search Bar, Pagination & View Switcher */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {/* Search Composite Pill */}
        <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 min-w-60 md:min-w-70">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <Input
            className="bg-transparent border-none outline-none text-xs placeholder:text-slate-400 w-full focus-visible:ring-0 shadow-none h-6 py-0 px-0"
            placeholder="Número, concepto o cuenta..."
            type="text"
            value={q}
            onChange={(e) => onBuscar(e.target.value)}
          />
          {q !== "" ? (
            <button
              className="text-slate-400 hover:text-slate-700 px-1 cursor-pointer shrink-0"
              type="button"
              title="Limpiar búsqueda"
              onClick={onLimpiarBusqueda}
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="px-1 shrink-0 text-slate-300" aria-hidden="true">
              <Filter className="w-4 h-4" />
            </span>
          )}
        </div>

        <Button
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-all cursor-pointer h-9"
          type="button"
          onClick={onNuevo}
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo</span>
        </Button>

        <Button
          variant="outline"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none shadow-none cursor-pointer h-8"
          type="button"
        >
          <Download className="w-4 h-4" />
          <span>Exportar XLSX</span>
        </Button>

        {/* View Switcher Tabs 
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5  ">
          {vistas.map(({ valor, titulo, Icono }) => (
            <Button
              key={valor}
              variant="ghost"
              size="icon"
              onClick={() => setVista(valor)}
              className={`p-1.5 rounded-md cursor-pointer transition-colors h-7 w-7 ${vista === valor
                ? "bg-white text-red-700 shadow-xs font-semibold hover:bg-white"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                }`}
              title={titulo}
              type="button"
            >
              <Icono className="w-4 h-4" />
            </Button>
          ))}
        </div>*/}
      </div>
    </div>
  );
}
