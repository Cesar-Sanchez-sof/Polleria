"use client";

import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatearFecha,
  type OpcionesAsientos,
} from "@/lib/services/asientos.service";

/** Identificador de cada chip de filtro activo. */
export type FiltroChip = "desde" | "hasta" | "diario" | "estado" | "q";

interface Props {
  desde: string;
  hasta: string;
  diario: string;
  estadoFiltro: string;
  /** Búsqueda ya confirmada (con debounce aplicado). */
  busqueda: string;
  opciones: OpcionesAsientos | null;
  hayFiltros: boolean;
  onDesde: (valor: string) => void;
  onHasta: (valor: string) => void;
  onEstado: (valor: string) => void;
  onLimpiar: () => void;
  onQuitar: (chip: FiltroChip) => void;
}

interface ChipFiltro {
  id: FiltroChip;
  etiqueta: string;
}

/** Barra de filtros combinados (fechas, estado) con sus chips removibles. */
export function FiltrosAsientos({
  desde,
  hasta,
  diario,
  estadoFiltro,
  busqueda,
  opciones,
  hayFiltros,
  onDesde,
  onHasta,
  onEstado,
  onLimpiar,
  onQuitar,
}: Readonly<Props>) {
  const estados = opciones?.estados ?? [
    { valor: "registrado", etiqueta: "Registrado", total: 0 },
    { valor: "anulado", etiqueta: "Anulado", total: 0 },
  ];

  const opcionesEstado = [
    { value: "todos", label: "Todos los estados" },
    ...estados.map((est) => ({ value: est.valor, label: `${est.etiqueta} (${est.total})` })),
  ];

  const etiquetaEstado =
    estados.find((est) => est.valor === estadoFiltro)?.etiqueta ?? estadoFiltro;

  const chips: ChipFiltro[] = [];
  if (desde) chips.push({ id: "desde", etiqueta: `Desde ${formatearFecha(desde)}` });
  if (hasta) chips.push({ id: "hasta", etiqueta: `Hasta ${formatearFecha(hasta)}` });
  if (diario !== "todos") chips.push({ id: "diario", etiqueta: `Diario: ${diario}` });
  if (estadoFiltro !== "todos") chips.push({ id: "estado", etiqueta: `Estado: ${etiquetaEstado}` });
  if (busqueda.trim() !== "")
    chips.push({ id: "q", etiqueta: `Búsqueda: "${busqueda.trim()}"` });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col lg:flex-row gap-1">
          <label
            htmlFor="filtro-desde"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"
          >
            <CalendarDays className="w-3.5 h-3.5" /> Desde
          </label>
          <Input
            id="filtro-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => onDesde(e.target.value)}
            className="h-9 w-34 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-1">
          <label
            htmlFor="filtro-hasta"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"
          >
            <CalendarDays className="w-3.5 h-3.5" /> Hasta
          </label>
          <Input
            id="filtro-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => onHasta(e.target.value)}
            className="h-9 w-34 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-1">
          <label
            id="filtro-estado-label"
            htmlFor="estadoFiltro"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"
          >
            Estado
          </label>
          <Select
            id="estadoFiltro"
            value={estadoFiltro}
            items={opcionesEstado}
            onValueChange={(valor) => onEstado(valor ?? "todos")}
          >
            <SelectTrigger
              className="w-40 rounded-lg bg-white text-xs"
              aria-labelledby="filtro-estado-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesEstado.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onLimpiar}
            disabled={!hayFiltros}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <X className="w-4 h-4" />
            <span>Limpiar filtros</span>
          </Button>
        </div>
      </div>

      {/* Chips con los filtros aplicados (se pueden quitar uno a uno) 
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Filtros aplicados
          </span>
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs"
            >
              <span>{chip.etiqueta}</span>
              <button
                type="button"
                onClick={() => onQuitar(chip.id)}
                className="hover:text-purple-200 ml-0.5 text-sm leading-none cursor-pointer"
                title="Quitar filtro"
              >
                <X className="w-3 h-3 inline" />
              </button>
            </span>
          ))}
        </div>
      )}
        */}
    </div>
  );
}
