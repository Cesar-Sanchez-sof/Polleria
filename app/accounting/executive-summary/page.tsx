"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ExecutiveSummaryFilters } from "./components/ExecutiveSummaryFilters";
import { ExecutiveSummaryPanel } from "./components/ExecutiveSummaryPanel";
import {
  getExecutiveSummary,
  formatYear,
  type ExecutiveSummary,
} from "@/lib/services/executive-summary.service";

/** Años ofrecidos en el selector: 5 atrás, el actual y el siguiente. */
function yearOptions(current: number): number[] {
  return Array.from({ length: 7 }, (_, index) => current - 4 + index);
}

/**
 * Resumen Ejecutivo: consolida efectivo, rentabilidad, balance general,
 * rendimiento y posición del ejercicio seleccionado.
 */
export default function ExecutiveSummaryPage() {
  const currentYear = useMemo(() => new Date().getUTCFullYear(), []);
  const years = useMemo(() => yearOptions(currentYear), [currentYear]);

  const [year, setYear] = useState<number>(currentYear);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const isCustomYear = year !== currentYear;

  const load = useCallback(async (targetYear: number) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getExecutiveSummary(targetYear);
      if (request !== requestRef.current) return;
      setSummary(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setSummary(null);
      setError(
        e instanceof Error ? e.message : "No se pudo generar el Resumen Ejecutivo."
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void load(year);
    }, 0);
    return () => clearTimeout(timer);
  }, [year, load]);

  return (
    <>
      <ModuleHeader
        title="Resumen Ejecutivo"
        subtitle="Efectivo, rentabilidad, balance, rendimiento y posición del ejercicio."
        icon={LayoutDashboard}
        iconClassName="bg-slate-900 text-white"
      >
        <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
          Ejercicio:{" "}
          <span className="font-semibold text-slate-900">{formatYear(year)}</span>
        </span>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-4 sm:p-6 flex flex-col gap-5 print:shadow-none print:border-0">
            <ExecutiveSummaryFilters
              year={year}
              years={years}
              onYear={setYear}
              onReset={() => setYear(currentYear)}
              onPrint={() => window.print()}
              isCustomYear={isCustomYear}
              currentYear={currentYear}
            />
            <ExecutiveSummaryPanel summary={summary} loading={loading} error={error} />
          </Card>
        </div>
      </main>
    </>
  );
}
