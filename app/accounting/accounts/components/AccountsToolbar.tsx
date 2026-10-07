"use client";

import { Filter, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPES } from "@/lib/services/accounts.service";

interface AccountsToolbarProps {
  q: string;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  type: string;
  onType: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  onNew: () => void;
  visible: number;
  total: number;
  loading: boolean;
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

export function AccountsToolbar({
  q,
  onSearch,
  onClearSearch,
  type,
  onType,
  status,
  onStatus,
  onNew,
  visible,
  total,
  loading,
}: Readonly<AccountsToolbarProps>) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        {loading
          ? "Cargando cuentas…"
          : `${visible} de ${total} cuenta${total === 1 ? "" : "s"} en pantalla`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 min-w-55 md:min-w-70">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <Input
            className="bg-transparent dark:bg-transparent border-none outline-none text-xs placeholder:text-slate-400 w-full focus-visible:ring-0 shadow-none h-6 py-0 px-0"
            placeholder="Código, nombre o tipo de cuenta..."
            type="text"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Buscar cuentas"
          />
          {q !== "" ? (
            <button
              className="text-slate-400 hover:text-slate-700 px-1 cursor-pointer shrink-0"
              type="button"
              title="Limpiar búsqueda"
              onClick={onClearSearch}
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
          value={type}
          items={TYPE_OPTIONS}
          onValueChange={(val) => onType(val ?? "todos")}
          disabled={loading}
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
          value={status}
          items={STATUS_OPTIONS}
          onValueChange={(val) => onStatus(val ?? "todos")}
          disabled={loading}
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
          onClick={onNew}
        >
          <Plus className="w-4 h-4" />
          <span>Nueva cuenta</span>
        </Button>
      </div>
    </div>
  );
}
