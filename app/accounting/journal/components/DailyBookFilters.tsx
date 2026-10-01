"use client";

import { FunnelX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  from: string;
  to: string;
  /** `true` when a period or filter is active. */
  hasFilters: boolean;
  /** `true` when the date range is invalid (from > to). */
  invalidRange: boolean;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onClear: () => void;
}

/**
 * Daily book date filter: start date and end date (both inclusive).
 */
export function DailyBookFilters({
  from,
  to,
  hasFilters,
  invalidRange,
  onFrom,
  onTo,
  onClear,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3 bg-slate-50/70 rounded-lg px-3 py-2.5">
        <div className="flex flex-row items-end gap-2">
          <label
            htmlFor="journal-from"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Desde
          </label>
          <Input
            id="journal-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Fecha inicial del periodo"
            className="h-9 w-36 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
          <label
            htmlFor="journal-to"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Hasta
          </label>
          <Input
            id="journal-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            aria-label="Fecha final del periodo"
            className="h-9 w-36 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
        </div>

        <span className="text-[11px] text-slate-400 pb-2.5">
          Sin fechas se muestran todos los asientos.
        </span>

        <div className="ml-auto">
          <Button
            variant="outline"
            type="button"
            onClick={onClear}
            disabled={!hasFilters}
            title="Limpiar filtros"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-900 text-white hover:text-white rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <FunnelX className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {invalidRange && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          La fecha inicial no puede ser posterior a la fecha final.
        </p>
      )}
    </div>
  );
}
