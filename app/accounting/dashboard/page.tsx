"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  RefreshCw,
  FileSpreadsheet,
  PlusCircle,
  HelpCircle,
  Coins,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { DashboardKpis } from "./components/DashboardKpis";
import { DashboardCharts } from "./components/DashboardCharts";
import { DashboardFilters } from "./components/DashboardFilters";
import { FinancialHealthBanner } from "./components/FinancialHealthBanner";
import { exportDashboardCsv } from "./components/dashboard-utils";
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
  from: string;
  to: string;
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
 * Dashboard contable (Resumen Financiero Ejecutivo):
 * - KPIs comparativos del período con variación vs período anterior
 * - Diagnóstico financiero y de liquidez ejecutiva
 * - Serie mensual interactiva (P&L, curvas de área, desglose)
 * - Estructura de gastos por categoría PCGE y cuentas de mayor movimiento
 * - Exportación a CSV, atajos de rango rápido y enlaces a reportes oficiales
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

  const load = useCallback(async (from: string, to: string) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboard(from, to);
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
      void load(range.from, range.to);
    }, 0);
    return () => clearTimeout(timer);
  }, [range, load]);

  const changeRange = useCallback((from: string, to: string) => {
    setRange({ from, to });
  }, []);

  const last12Months = useCallback(() => {
    const today = todayIso();
    setRange({ from: addMonths(today, -12), to: today });
  }, []);

  const currentPeriod = useCallback(() => {
    if (openPeriod) setRange(resolveDefaultRange(openPeriod, todayIso()));
  }, [openPeriod]);

  const handleRefresh = useCallback(() => {
    if (range) void load(range.from, range.to);
  }, [range, load]);

  const handleExportCsv = useCallback(() => {
    if (payload) {
      exportDashboardCsv(payload);
    }
  }, [payload]);

  const visibleLabel = useMemo(
    () => payload?.period.label ?? (range ? formatRangeLabel(range.from, range.to) : "—"),
    [payload, range]
  );

  return (
    <>
      <ModuleHeader
        title="Dashboard Contable"
        subtitle="Centro de inteligencia financiera: KPIs, balance patrimonial, liquidez y tendencias operativas."
        icon={LayoutDashboard}
        iconClassName="bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground"
      >
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-2xs">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span>Moneda: PEN (Soles)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-bold text-foreground">{visibleLabel}</span>
          </span>
        </div>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-5 md:p-6">
        <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto">
          {/* Barra de Filtros y Atajos Rápidos */}
          <Card className="bg-card border border-border/80 rounded-2xl shadow-xs p-4 sm:p-5">
            {range ? (
              <DashboardFilters
                from={range.from}
                to={range.to}
                onChange={changeRange}
                onLast12Months={last12Months}
                hasOpenPeriod={openPeriod !== null}
                onOpenPeriod={currentPeriod}
                loading={loading}
                onRefresh={handleRefresh}
                onExportCsv={payload && !payload.meta.empty ? handleExportCsv : undefined}
              />
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Inicializando parámetros contables…</span>
              </div>
            )}
          </Card>

          {/* Banner de Diagnóstico Ejecutivo y Ratios Financieros */}
          {!error && !loading && payload && !payload.meta.empty && (
            <FinancialHealthBanner payload={payload} />
          )}

          {/* Estado de Error */}
          {error ? (
            <Card className="bg-card border border-destructive/30 rounded-2xl shadow-xs p-8 flex flex-col items-center gap-3 text-center">
              <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <HelpCircle className="h-5 w-5" />
              </div>
              <p className="text-sm text-destructive font-semibold">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 mt-1"
                onClick={() => range && load(range.from, range.to)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar Carga
              </Button>
            </Card>
          ) : null}

          {/* Estado Vacío */}
          {!error && !loading && payload?.meta.empty ? (
            <Card className="bg-card border border-dashed border-border rounded-2xl shadow-xs p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-foreground">
                  Sin movimientos contables en este período
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  No se encontraron asientos vigentes ni transacciones para el rango del{" "}
                  <span className="font-semibold text-foreground">
                    {formatCutOffDate(range?.from ?? "")}
                  </span>{" "}
                  al{" "}
                  <span className="font-semibold text-foreground">
                    {formatCutOffDate(range?.to ?? "")}
                  </span>
                  .
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={last12Months}
                  className="text-xs"
                >
                  Consultar Últimos 12 Meses
                </Button>
                <Link
                  href="/accounting/entries"
                  className={cn(buttonVariants({ size: "sm" }), "text-xs gap-1.5")}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Registrar Asiento Contable
                </Link>
              </div>
            </Card>
          ) : null}

          {/* KPIs y Gráficos cuando hay datos */}
          {payload && !payload.meta.empty ? (
            <>
              {loading ? (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-2xl border border-border/60 bg-card shadow-xs"
                    />
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
