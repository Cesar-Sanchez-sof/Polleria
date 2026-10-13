"use client";

import { CalendarRange, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** Fecha inicial del periodo (YYYY-MM-DD). */
  desde: string;
  /** Fecha final del periodo (YYYY-MM-DD). */
  hasta: string;
  /** `true` cuando `desde` es posterior a `hasta`. */
  invalidRange: boolean;
  /** `true` cuando el periodo mostrado difiere del periodo por defecto (mes en curso). */
  hasCustomPeriod: boolean;
  onDesde: (value: string) => void;
  onHasta: (value: string) => void;
  /** Restaura el periodo por defecto (primer día del mes en curso → hoy). */
  onReset: () => void;
  onPrint: () => void;
}

/**
 * Filtro de periodo del Estado de Resultados: fecha inicial y final (ambas inclusivas).
 */
export function IncomeStatementFilters({
  desde,
  hasta,
  invalidRange,
  hasCustomPeriod,
  onDesde,
  onHasta,
  onReset,
  onPrint,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-3 bg-slate-50/70 dark:bg-slate-800/75 rounded-lg px-3 py-2.5">
        <div className="flex flex-row items-center gap-2">
          <label
            htmlFor="income-statement-desde"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Desde
          </label>
          <Input
            id="income-statement-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => onDesde(e.target.value)}
            aria-label="Fecha inicial del periodo"
            className="h-9 w-36 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
          <label
            htmlFor="income-statement-hasta"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Hasta
          </label>
          <Input
            id="income-statement-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => onHasta(e.target.value)}
            aria-label="Fecha final del periodo"
            className="h-9 w-36 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
        </div>

        <span className="text-[11px] text-slate-400 max-w-md">
          Sólo se consideran asientos vigentes dentro del periodo; las cuentas sin movimientos
          muestran S/ 0.00.
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onReset}
            disabled={!hasCustomPeriod}
            title="Ver el mes en curso"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-900 text-white hover:text-white rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <CalendarRange className="w-4 h-4" />
            Este mes
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
