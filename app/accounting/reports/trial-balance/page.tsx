"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { ListChecks } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { TrialBalanceFilters } from "./components/TrialBalanceFilters";
import { TrialBalanceTable } from "./components/TrialBalanceTable";
import {
  getTrialBalance,
  type TrialBalanceStatement,
} from "@/lib/services/trial-balance.service";
import { formatDateToIso } from "@/lib/dates";

function todayIso(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

/** Primer día del mes (UTC) de la fecha ISO dada. */
function firstDayOfMonthIso(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Balance de Comprobación: saldos iniciales, movimiento del periodo y saldos
 * finales por elemento y sub-elemento del plan contable (PCGE).
 */
export default function TrialBalancePage() {
  const today = useMemo(() => todayIso(), []);
  const defaultPeriod = useMemo(
    () => ({ from: firstDayOfMonthIso(today), to: today }),
    [today]
  );

  const [from, setFrom] = useState<string>(defaultPeriod.from);
  const [to, setTo] = useState<string>(defaultPeriod.to);
  const [statement, setStatement] = useState<TrialBalanceStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const invalidRange = from > to;
  const isCustomPeriod = from !== defaultPeriod.from || to !== defaultPeriod.to;

  const load = useCallback(async (periodFrom: string, periodTo: string) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTrialBalance(periodFrom, periodTo);
      if (request !== requestRef.current) return;
      setStatement(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setStatement(null);
      setError(
        e instanceof Error ? e.message : "No se pudo generar el Balance de Comprobación."
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Un rango invertido no se consulta: el aviso lo deriva el propio estado.
    if (invalidRange) return;
    const timer = setTimeout(() => {
      void load(from, to);
    }, 0);
    return () => clearTimeout(timer);
  }, [from, to, invalidRange, load]);

  const resetPeriod = () => {
    setFrom(defaultPeriod.from);
    setTo(defaultPeriod.to);
  };

  const displayedError = invalidRange
    ? "La fecha inicial no puede ser posterior a la fecha final."
    : error;

  return (
    <>
      <ModuleHeader
        title="Balance de Comprobación"
        subtitle="Saldos iniciales, movimiento del periodo y saldos finales por elemento del plan contable."
        icon={ListChecks}
        iconClassName="bg-slate-900 text-white"
      >
        <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
          Periodo:{" "}
          <span className="font-semibold text-slate-900">
            {statement && !invalidRange ? statement.periodLabel : `${from} al ${to}`}
          </span>
        </span>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-4 sm:p-6 flex flex-col gap-5 print:shadow-none print:border-0">
            <TrialBalanceFilters
              from={from}
              to={to}
              onFrom={setFrom}
              onTo={setTo}
              onReset={resetPeriod}
              onPrint={() => window.print()}
              isCustomPeriod={isCustomPeriod}
              invalidRange={invalidRange}
            />
            <TrialBalanceTable statement={statement} loading={loading} error={displayedError} />
          </Card>
        </div>
      </main>
    </>
  );
}
