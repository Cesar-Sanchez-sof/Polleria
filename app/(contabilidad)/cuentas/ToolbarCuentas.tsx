"use client";

import { BookOpen, Filter, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_CUENTA } from "@/lib/services/cuentas.service";

interface Props {
  /** Texto actual del buscador (filtra código, nombre y tipo). */
  q: string;
  onBuscar: (valor: string) => void;
  onLimpiarBusqueda: () => void;
  /** Tipo seleccionado o `"todos"`. */
  tipo: string;
  onTipo: (valor: string) => void;
  /** Estado seleccionado: `"todos"`, `"activas"` o `"inactivas"`. */
  estado: string;
  onEstado: (valor: string) => void;
  /** Abre el diálogo para registrar una cuenta nueva. */
  onNuevo: () => void;
  /** Cuentas que muestra la tabla ahora mismo. */
  visibles: number;
  /** Cuentas existentes en el plan. */
  total: number;
  cargando: boolean;
}

const OPCIONES_TIPO = [
  { value: "todos", label: "Todos los tipos" },
  ...TIPOS_CUENTA.map((tipo) => ({ value: tipo, label: tipo })),
];

const OPCIONES_ESTADO = [
  { value: "todos", label: "Todos los estados" },
  { value: "activas", label: "Activas" },
  { value: "inactivas", label: "Inactivas" },
];

/** Barra superior: título, buscador, filtros de tipo/estado y alta de cuentas. */
export function ToolbarCuentas({
  q,
  onBuscar,
  onLimpiarBusqueda,
  tipo,
  onTipo,
  estado,
  onEstado,
  onNuevo,
  visibles,
  total,
  cargando,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* LEFT: Título y conteo del plan */}
      <div className="flex flex-col items-start gap-0">
        <div className="flex justify-start items-center gap-2">
          <BookOpen className="w-7 h-7" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cuentas contables</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {cargando
            ? "Cargando cuentas…"
            : `${visibles} de ${total} cuenta${total === 1 ? "" : "s"} en pantalla`}
        </p>
      </div>

      {/* RIGHT: Buscador, filtros y alta */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {/* Search Composite Pill */}
        <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 min-w-55 md:min-w-70">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <Input
            className="bg-transparent border-none outline-none text-xs placeholder:text-slate-400 w-full focus-visible:ring-0 shadow-none h-6 py-0 px-0"
            placeholder="Código, nombre o tipo de cuenta..."
            type="text"
            value={q}
            onChange={(e) => onBuscar(e.target.value)}
            aria-label="Buscar cuentas"
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

        <Select
          value={tipo}
          items={OPCIONES_TIPO}
          onValueChange={(valor) => onTipo(valor ?? "todos")}
          disabled={cargando}
        >
          <SelectTrigger
            className="h-9 rounded-lg bg-white text-xs min-w-40"
            aria-label="Filtrar por tipo de cuenta"
          >
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_TIPO.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={estado}
          items={OPCIONES_ESTADO}
          onValueChange={(valor) => onEstado(valor ?? "todos")}
          disabled={cargando}
        >
          <SelectTrigger
            className="h-9 rounded-lg bg-white text-xs min-w-40"
            aria-label="Filtrar por estado de la cuenta"
          >
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ESTADO.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-all cursor-pointer h-9"
          type="button"
          onClick={onNuevo}
        >
          <Plus className="w-4 h-4" />
          <span>Nueva cuenta</span>
        </Button>
      </div>
    </div>
  );
}
