"use client";

import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdvancedFilterBar } from "@/components/shared/AdvancedFilterBar";

interface Props {
  from: string;
  to: string;
  search: string;
  statusFilter: "" | "registrado" | "anulado";
  bookFilter: string;
  /** `true` when a period or filter is active. */
  hasFilters: boolean;
  /** `true` when the date range is invalid (from > to). */
  invalidRange: boolean;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onSearch: (value: string) => void;
  onStatus: (value: "" | "registrado" | "anulado") => void;
  onBook: (value: string) => void;
  onClear: () => void;
  onExport?: () => void;
  exporting?: boolean;
}

/**
 * Daily book filters: free-text query, book, status, and inclusive date range.
 */
export function DailyBookFilters({
  from,
  to,
  search,
  statusFilter,
  bookFilter,
  hasFilters,
  invalidRange,
  onFrom,
  onTo,
  onSearch,
  onStatus,
  onBook,
  onClear,
  onExport,
  exporting = false,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-2">
      <AdvancedFilterBar
        search={search}
        onSearchChange={onSearch}
        searchPlaceholder="Buscar número, concepto, cuenta o responsable..."
        maxSearchLength={200}
        activeFilterCount={
          Number(Boolean(from)) +
          Number(Boolean(to)) +
          Number(Boolean(statusFilter)) +
          Number(Boolean(bookFilter.trim()))
        }
        hasActiveFilters={hasFilters}
        onClear={onClear}
        actions={
          onExport && (
            <Button
              variant="outline"
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="h-9 cursor-pointer gap-1.5 rounded-lg px-3 text-xs font-semibold"
            >
              {exporting ? (
                <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{exporting ? "Exportando..." : "Exportar XLSX"}</span>
            </Button>
          )
        }
      >
        <label className="flex min-w-[145px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Desde
          <Input
            id="journal-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Fecha inicial del periodo"
            className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal"
          />
        </label>
        <label className="flex min-w-[145px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Hasta
          <Input
            id="journal-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            aria-label="Fecha final del periodo"
            className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal"
          />
        </label>
        <label className="flex min-w-[150px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Libro / subdiario
          <Input
            type="text"
            maxLength={100}
            value={bookFilter}
            onChange={(e) => onBook(e.target.value)}
            placeholder="Todos los libros"
            aria-label="Filtrar por libro o subdiario"
            className="h-9 rounded-lg bg-background text-xs font-normal normal-case tracking-normal"
          />
        </label>
        <label
          htmlFor="journal-status"
          className="flex min-w-[140px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
          Estado
          <Select
            value={statusFilter || "todos"}
            items={[
              { value: "todos", label: "Todos" },
              { value: "registrado", label: "Registrados" },
              { value: "anulado", label: "Anulados" },
            ]}
            onValueChange={(value) =>
              onStatus(value === "registrado" || value === "anulado" ? value : "")
            }
          >
            <SelectTrigger
              id="journal-status"
              className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="registrado">Registrados</SelectItem>
              <SelectItem value="anulado">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </AdvancedFilterBar>

      {invalidRange && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          La fecha inicial no puede ser posterior a la fecha final.
        </p>
      )}
    </div>
  );
}

/** @deprecated Use DailyBookFilters */
export const DailyFilters = DailyBookFilters;
