"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FunnelX, Printer } from "lucide-react";

interface Props {
  asOf: string;
  onAsOf: (value: string) => void;
  onClear: () => void;
  onPrint: () => void;
  hasCustomDate: boolean;
}

/** Filtro de fecha de corte del Estado de Situación Financiera. */
export function BalanceSheetFilters({
  asOf,
  onAsOf,
  onClear,
  onPrint,
  hasCustomDate,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-3 bg-slate-50/70 rounded-lg px-3 py-2.5">
        <div className="flex flex-row items-center gap-2">
          <label
            htmlFor="balance-as-of"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Fecha de corte
          </label>
          <Input
            id="balance-as-of"
            type="date"
            value={asOf}
            onChange={(e) => onAsOf(e.target.value)}
            aria-label="Fecha de corte del balance general"
            className="h-9 w-40 rounded-lg border-slate-200 bg-white text-xs shadow-none"
          />
        </div>

        <span className="text-[11px] text-slate-400 max-w-md">
          Saldos acumulados al cierre del día seleccionado (asientos vigentes). El resultado del
          ejercicio corresponde al año de la fecha de corte.
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onClear}
            disabled={!hasCustomDate}
            title="Usar fecha de hoy"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-900 text-white hover:text-white rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <FunnelX className="w-4 h-4" />
            Hoy
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
    </div>
  );
}
