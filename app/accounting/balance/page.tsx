"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Scale } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { BalanceSheetFilters } from "./components/BalanceSheetFilters";
import { BalanceSheetTable } from "./components/BalanceSheetTable";
import {
  formatCutOffDate,
  getBalanceSheet,
  type BalanceSheetStatement,
} from "@/lib/services/balance-sheet.service";
import { formatDateToIso } from "@/lib/dates";

function todayIso(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

/**
 * Estado de Situación Financiera (Balance General) según PCGE / presentación SUNAT.
 */
export default function BalanceSheetPage() {
  const today = useMemo(() => todayIso(), []);
  const [asOf, setAsOf] = useState<string>(today);
  const [statement, setStatement] = useState<BalanceSheetStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (cutOff: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutOff)) {
      setError("La fecha de corte debe tener el formato válido.");
      setStatement(null);
      setLoading(false);
      return;
    }
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getBalanceSheet(cutOff);
      if (request !== requestRef.current) return;
      setStatement(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setStatement(null);
      setError(
        e instanceof Error ? e.message : "No se pudo generar el Estado de Situación Financiera."
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(asOf);
    }, 0);
    return () => clearTimeout(timer);
  }, [asOf, load]);

  const clearToToday = () => setAsOf(today);

  return (
    <>
      <ModuleHeader
        title="Balance General"
        subtitle="Estado de Situación Financiera conforme al PCGE (activo, pasivo y patrimonio)."
        icon={Scale}
        iconClassName="bg-slate-900 text-white"
      >
        <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
          Corte:{" "}
          <span className="font-semibold text-slate-900">{formatCutOffDate(asOf)}</span>
        </span>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-4 sm:p-6 flex flex-col gap-5 print:shadow-none print:border-0">
            <BalanceSheetFilters
              asOf={asOf}
              onAsOf={setAsOf}
              onClear={clearToToday}
              onPrint={() => window.print()}
              hasCustomDate={asOf !== today}
            />
            <BalanceSheetTable statement={statement} loading={loading} error={error} />
          </Card>
        </div>
      </main>
    </>
  );
}
