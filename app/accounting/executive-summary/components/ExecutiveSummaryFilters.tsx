"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarRange, Printer } from "lucide-react";

interface Props {
  year: number;
  years: number[];
  onYear: (value: number) => void;
  onReset: () => void;
  onPrint: () => void;
  isCustomYear: boolean;
  currentYear: number;
}

/**
 * Filtro del Resumen Ejecutivo: selección del año calendario.
 */
export function ExecutiveSummaryFilters({
  year,
  years,
  onYear,
  onReset,
  onPrint,
  isCustomYear,
  currentYear,
}: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-3 bg-slate-50/70 dark:bg-slate-800/75 rounded-lg px-3 py-2.5">
        <div className="flex flex-row items-center gap-2">
          <label
            htmlFor="executive-summary-year"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            Ejercicio
          </label>
          <Select
            value={String(year)}
            onValueChange={(value) => {
              if (value) onYear(Number(value));
            }}
          >
            <SelectTrigger
              id="executive-summary-year"
              className="h-9 w-32 rounded-lg border-slate-200 bg-white text-xs shadow-none"
            >
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {years.map((value) => (
                <SelectItem key={value} value={String(value)} className="text-xs">
                  <span className="font-semibold tabular-nums">{value}</span>
                  {value === currentYear ? (
                    <span className="ml-1 text-slate-400">(en curso)</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-[11px] text-slate-400 max-w-md">
          Consolida efectivo, rentabilidad, balance, rendimiento y posición del año calendario
          seleccionado.
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onReset}
            disabled={!isCustomYear}
            title="Usar el año en curso"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-900 text-white hover:text-white rounded-lg text-xs font-semibold border-slate-200 shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            <CalendarRange className="w-4 h-4" />
            Este año
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
