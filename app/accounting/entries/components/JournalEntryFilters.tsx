"use client";

import { FunnelX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatDate,
  type JournalEntriesOptions,
} from "@/lib/services/journal-entries.service";

/** Identifier for each active filter chip. */
export type FilterChip = "from" | "to" | "journal" | "status" | "q";

interface Props {
  from: string;
  to: string;
  journal: string;
  statusFilter: string;
  /** Confirmed search query (debounced). */
  search: string;
  options: JournalEntriesOptions | null;
  hasFilters: boolean;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onStatus: (value: string) => void;
  onClear: () => void;
  onRemove: (chip: FilterChip) => void;
}

interface FilterChipItem {
  id: FilterChip;
  label: string;
}

/** Combined filters bar (dates, status) with removable chips. */
export function JournalEntryFilters({
  from,
  to,
  journal,
  statusFilter,
  search,
  options,
  hasFilters,
  onFrom,
  onTo,
  onStatus,
  onClear,
  onRemove,
}: Readonly<Props>) {
  const statuses = options?.estados ?? [
    { valor: "registrado", etiqueta: "Registrado", total: 0 },
    { valor: "anulado", etiqueta: "Anulado", total: 0 },
  ];

  const statusOptions = [
    { value: "todos", label: "Todos" },
    ...statuses.map((st) => ({ value: st.valor, label: `${st.etiqueta} (${st.total})` })),
  ];

  const statusLabel =
    statuses.find((st) => st.valor === statusFilter)?.etiqueta ?? statusFilter;

  const chips: FilterChipItem[] = [];
  if (from) chips.push({ id: "from", label: `Desde ${formatDate(from)}` });
  if (to) chips.push({ id: "to", label: `Hasta ${formatDate(to)}` });
  if (journal !== "todos") chips.push({ id: "journal", label: `Diario: ${journal}` });
  if (statusFilter !== "todos") chips.push({ id: "status", label: `Estado: ${statusLabel}` });
  if (search.trim() !== "")
    chips.push({ id: "q", label: `Búsqueda: "${search.trim()}"` });

  return (
    <>
      <div className="flex flex-col gap-3 bg-slate-50/70">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-row gap-2">
            <label
              htmlFor="filter-from"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"
            >
              De
            </label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onFrom(e.target.value)}
              className="h-9 w-34 rounded-lg border-slate-200 bg-white text-xs shadow-none"
            />
            <label
              htmlFor="filter-to"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"
            >
              A
            </label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onTo(e.target.value)}
              className="h-9 w-34 rounded-lg border-slate-200 bg-white text-xs shadow-none"
            />
          </div>

          <div className="flex flex-row gap-2">
            <label
              id="filter-status-label"
              htmlFor="statusFilter"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"
            >
              Estado
            </label>
            <Select
              id="statusFilter"
              value={statusFilter}
              items={statusOptions}
              onValueChange={(val) => onStatus(val ?? "todos")}
            >
              <SelectTrigger className="w-36 rounded-lg bg-white text-xs" aria-labelledby="filter-status-label" />
              <SelectContent>
                {statusOptions.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onClear}
            disabled={!hasFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-900 text-white hover:text-white rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <FunnelX className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </>
  );
}
