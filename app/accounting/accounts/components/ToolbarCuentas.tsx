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
import { ACCOUNT_TYPES } from "@/lib/services/cuentas.service";

interface ToolbarCuentasProps {
  q: string;
  onBuscar: (value: string) => void;
  onLimpiarBusqueda: () => void;
  tipo: string;
  onTipo: (value: string) => void;
  estado: string;
  onEstado: (value: string) => void;
  onNuevo: () => void;
  visibles: number;
  total: number;
  cargando: boolean;
}

const TYPE_OPTIONS = [
  { value: "todos", label: "Todos los tipos" },
  ...ACCOUNT_TYPES.map((type) => ({ value: type, label: type })),
];

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos los estados" },
  { value: "activas", label: "Activas" },
  { value: "inactivas", label: "Inactivas" },
];

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
}: Readonly<ToolbarCuentasProps>) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
          items={TYPE_OPTIONS}
          onValueChange={(val) => onTipo(val ?? "todos")}
          disabled={cargando}
        >
          <SelectTrigger
            className="h-9 rounded-lg bg-white text-xs min-w-40"
            aria-label="Filtrar por tipo de cuenta"
          >
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={estado}
          items={STATUS_OPTIONS}
          onValueChange={(val) => onEstado(val ?? "todos")}
          disabled={cargando}
        >
          <SelectTrigger
            className="h-9 rounded-lg bg-white text-xs min-w-40"
            aria-label="Filtrar por estado de la cuenta"
          >
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
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
