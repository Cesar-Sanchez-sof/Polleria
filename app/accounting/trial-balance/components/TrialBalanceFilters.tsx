"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarRange, Printer } from "lucide-react";

interface Props {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  /** Restaura el periodo por defecto (mes actual en curso). */
  onReset: () => void;
  onPrint: () => void;
  /** `true` cuando el usuario cambió el periodo por defecto. */
  isCustomPeriod: boolean;
  /** `true` cuando el rango no tiene sentido (inicial > final). */
  invalidRange: boolean;
}

/**
 * Filtros del Balance de Comprobación: periodo de fechas (C09), ambas inclusive.
 * El `max`/`min` de cada input impide elegir un rango invertido desde el navegador.
 */
export function TrialBalanceFilters({
  from,
  to,
  onFrom,
  onTo,
  onReset,
  onPrint,
  isCustomPeriod,
  invalidRange,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-end gap-3 bg-slate-50/70 dark:bg-slate-800/75 rounded-lg px-3 py-2.5">
        <div className="flex flex-row items-center gap-2 self-end pb-0">
          <label
            htmlFor="trial-balance-from"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Desde
          </label>
          <Input
            id="trial-balance-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Fecha inicial del periodo"
            className="h-9 w-40 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
          <label
            htmlFor="trial-balance-to"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Hasta
          </label>
          <Input
            id="trial-balance-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            aria-label="Fecha final del periodo"
            className="h-9 w-40 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
        </div>

        <span className="text-[11px] text-slate-400 max-w-md self-end pb-2.5">
          Saldos iniciales al cierre del día anterior, movimiento del periodo y saldos finales
          (asientos vigentes).
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onReset}
            disabled={!isCustomPeriod}
            title="Volver al mes en curso"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-900 text-white hover:text-white rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <CalendarRange className="w-4 h-4" />
            Mes actual
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-none cursor-pointer h-9"
          >
            <Printer className="w-4 h-4" />
            Imprimir
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
