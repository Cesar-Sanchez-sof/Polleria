"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { DashboardKpis } from "./components/DashboardKpis";
import { DashboardCharts } from "./components/DashboardCharts";
import { DashboardFilters } from "./components/DashboardFilters";
import {
  getDashboard,
  formatCutOffDate,
  type DashboardPayload,
} from "@/lib/services/dashboard.service";
import { formatDateToIso } from "@/lib/dates";
import { formatRangeLabel, resolveDefaultRange } from "@/lib/accounting/dashboard";

function todayIso(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return formatDateToIso(
    new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)))
  );
}

interface DateRange {
  desde: string;
  hasta: string;
}

/** Periodo contable abierto, si existe (GET /api/accounting-periods?status=open). */
async function fetchOpenPeriod(): Promise<{ startDate: string; endDate: string } | null> {
  try {
    const res = await fetch("/api/accounting-periods?status=open", { cache: "no-store" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!Array.isArray(body) || body.length === 0) return null;
    const first = body[0] as { startDate?: string; endDate?: string };
    if (!first?.startDate || !first?.endDate) return null;
    return {
      startDate: formatDateToIso(new Date(first.startDate)),
      endDate: formatDateToIso(new Date(first.endDate)),
    };
  } catch {
    return null;
  }
}

/**
 * Dashboard contable (Resumen Financiero, spec 026): KPIs del período con
 * variación vs el período anterior, serie mensual, distribución de gastos y
 * cuentas con mayor movimiento. Período por defecto: periodo contable abierto
 * o últimos 12 meses (R4). Control de carreras con `requestRef` (FR-014).
 */
export default function AccountingDashboardPage() {
  const [range, setRange] = useState<DateRange | null>(null);
  const [openPeriod, setOpenPeriod] = useState<{ startDate: string; endDate: string } | null>(
    null
  );
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  // Rango por defecto al montar: periodo contable abierto o últimos 12 meses.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const period = await fetchOpenPeriod();
      if (cancelled) return;
      setOpenPeriod(period);
      setRange(resolveDefaultRange(period, todayIso()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (desde: string, hasta: string) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboard(desde, hasta);
      if (request !== requestRef.current) return; // respuesta obsoleta (FR-014)
      setPayload(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setPayload(null);
      setError(
        e instanceof Error ? e.message : "No se pudo generar el Dashboard Contable."
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!range) return;
    const timer = setTimeout(() => {
      void load(range.desde, range.hasta);
    }, 0);
    return () => clearTimeout(timer);
  }, [range, load]);

  const changeRange = useCallback((desde: string, hasta: string) => {
    setRange({ desde, hasta });
  }, []);

  const last12Months = useCallback(() => {
    const today = todayIso();
    setRange({ desde: addMonths(today, -12), hasta: today });
  }, []);

  const currentPeriod = useCallback(() => {
    if (openPeriod) setRange(resolveDefaultRange(openPeriod, todayIso()));
  }, [openPeriod]);

  const visibleLabel = useMemo(
    () => payload?.period.label ?? (range ? formatRangeLabel(range.desde, range.hasta) : "—"),
    [payload, range]
  );

  return (
    <>
      <ModuleHeader
        title="Dashboard Contable"
        subtitle="Resumen financiero: KPIs, tendencias y concentración de gastos del período."
        icon={LayoutDashboard}
        iconClassName="bg-slate-900 text-white"
      >
        <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
          Período: <span className="font-semibold text-slate-900">{visibleLabel}</span>
        </span>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-4">
            {range ? (
              <DashboardFilters
                desde={range.desde}
                hasta={range.hasta}
                onChange={changeRange}
                onLast12Months={last12Months}
                hasOpenPeriod={openPeriod !== null}
                onOpenPeriod={currentPeriod}
                loading={loading}
              />
            ) : (
              <span className="text-xs text-slate-400">Preparando dashboard…</span>
            )}
          </Card>

          {error ? (
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-red-700 font-medium">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => range && load(range.desde, range.hasta)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </Card>
          ) : null}

          {!error && !loading && payload?.meta.empty ? (
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">Sin movimientos en el periodo</p>
              <p className="mt-1 text-xs text-slate-400">
                Rango seleccionado: {formatCutOffDate(range?.desde ?? "")} —{" "}
                {formatCutOffDate(range?.hasta ?? "")}
              </p>
            </Card>
          ) : null}

          {payload && !payload.meta.empty ? (
            <>
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl border bg-white shadow-sm" />
                  ))}
                </div>
              ) : (
                <DashboardKpis kpis={payload.kpis} />
              )}
              <DashboardCharts
                monthlySeries={payload.monthlySeries}
                expenseBreakdown={payload.expenseBreakdown}
                topAccounts={payload.topAccounts}
                loading={loading}
              />
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
