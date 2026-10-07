"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { IncomeStatementFilters } from "./components/IncomeStatementFilters";
import { IncomeStatementTable } from "./components/IncomeStatementTable";
import {
  formatPeriodLabel,
  getIncomeStatement,
  type IncomeStatementResult,
} from "@/lib/services/income-statement-api.service";
import { formatDateToIso } from "@/lib/dates";

function todayIso(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

function firstDayOfMonthIso(): string {
  const now = new Date();
  return formatDateToIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

/**
 * Estado de Resultados por Función (PCGE 2019 / NIIF).
 *
 * Periodo por defecto: del primer día del mes en curso a hoy. Los datos llegan de
 * `GET /api/income-statement`; el cálculo vive en `lib/accounting/income-statement.ts`.
 *
 * La lógica de presentación está en ./components/IncomeStatementFilters.tsx y
 * ./components/IncomeStatementTable.tsx.
 */
export default function IncomeStatementPage() {
  const defaults = useMemo(
    () => ({ desde: firstDayOfMonthIso(), hasta: todayIso() }),
    []
  );

  const [desde, setDesde] = useState<string>(defaults.desde);
  const [hasta, setHasta] = useState<string>(defaults.hasta);
  const [result, setResult] = useState<IncomeStatementResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sólo la última petición puede escribir estado.
  const requestRef = useRef(0);

  const invalidRange = Boolean(desde && hasta && desde > hasta);
  const hasCustomPeriod = desde !== defaults.desde || hasta !== defaults.hasta;

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getIncomeStatement({ desde, hasta });
      if (request !== requestRef.current) return;
      setResult(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setResult(null);
      setError(
        e instanceof Error ? e.message : "No se pudo generar el Estado de Resultados."
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    // Un rango invertido no se consulta: el aviso se deriva del propio estado
    // (`displayedError`), sin ejecutar setState en el cuerpo del efecto.
    if (invalidRange) return;
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, invalidRange]);

  const resetToCurrentMonth = () => {
    setDesde(defaults.desde);
    setHasta(defaults.hasta);
  };

  const displayedError = invalidRange
    ? "La fecha inicial no puede ser posterior a la fecha final."
    : error;
  const isLoading = loading && !invalidRange;
  const periodLabel =
    !invalidRange && desde && hasta ? formatPeriodLabel(desde, hasta) : "Periodo inválido";

  return (
    <>
      <ModuleHeader
        title="Estado de Resultados"
        subtitle="Ingresos, costos, gastos y utilidad del periodo según el PCGE 2019."
        icon={TrendingUp}
        iconClassName="bg-emerald-100 text-emerald-800"
      >
        <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
          Periodo:{" "}
          <span className="font-semibold text-slate-900">{periodLabel}</span>
        </span>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-4 sm:p-6 flex flex-col gap-5 print:shadow-none print:border-0">
            <IncomeStatementFilters
              desde={desde}
              hasta={hasta}
              invalidRange={invalidRange}
              hasCustomPeriod={hasCustomPeriod}
              onDesde={setDesde}
              onHasta={setHasta}
              onReset={resetToCurrentMonth}
              onPrint={() => window.print()}
            />
            <IncomeStatementTable
              result={result}
              loading={isLoading}
              error={displayedError}
            />
          </Card>
        </div>
      </main>
    </>
  );
}
