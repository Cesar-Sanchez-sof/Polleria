"use client";

import { CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardFiltersProps {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  onLast12Months: () => void;
  /** Se muestra solo si existe un periodo contable abierto. */
  hasOpenPeriod: boolean;
  onOpenPeriod: () => void;
  loading: boolean;
}

/** Selector de período del dashboard (US3, FR-007/FR-008): rango + atajos. */
export function DashboardFilters({
  desde,
  hasta,
  onChange,
  onLast12Months,
  hasOpenPeriod,
  onOpenPeriod,
  loading,
}: Readonly<DashboardFiltersProps>) {
  const inputClass =
    "h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-900 bg-white";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Desde
        <input
          type="date"
          value={desde}
          onChange={(e) => onChange(e.target.value, hasta)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Hasta
        <input
          type="date"
          value={hasta}
          onChange={(e) => onChange(desde, e.target.value)}
          className={inputClass}
        />
      </label>
      {hasOpenPeriod ? (
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onOpenPeriod}>
          <CalendarDays className="h-3.5 w-3.5" />
          Periodo actual
        </Button>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={onLast12Months}>
        <RotateCcw className="h-3.5 w-3.5" />
        Últimos 12 meses
      </Button>
      {loading ? (
        <span className="pb-2 text-xs text-slate-400">Cargando dashboard…</span>
      ) : null}
    </div>
  );
}
