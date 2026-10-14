"use client";

import Link from "next/link";
import { Scale, TrendingUp, FileText, BookOpen } from "lucide-react";
import { formatPen } from "@/lib/services/dashboard.service";
import type { DashboardPayload } from "@/lib/services/dashboard.service";
import { calculateFinancialHealth } from "./dashboard-utils";

interface FinancialHealthBannerProps {
  payload: DashboardPayload | null;
}

export function FinancialHealthBanner({ payload }: Readonly<FinancialHealthBannerProps>) {
  const health = calculateFinancialHealth(payload);
  if (!health || !payload) return null;

  const isHealthyLiquidity = health.liquidityStatus === "healthy";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
      {/* Ratios Clave de Gestión */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Ratio 1: Margen Neto */}
        <div className="flex flex-col rounded-xl bg-background/80 border border-border/60 p-2.5 min-w-[125px] shadow-2xs">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            Margen Neto
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-black ${
                health.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
              }`}
            >
              {health.margin.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">de los ingresos</span>
        </div>

        {/* Ratio 2: Cobertura Inmediata (Caja vs Por Pagar) */}
        <div className="flex flex-col rounded-xl bg-background/80 border border-border/60 p-2.5 min-w-[125px] shadow-2xs">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            Cobertura Inmediata
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-black ${
                isHealthyLiquidity ? "text-blue-600 dark:text-blue-400" : "text-amber-600"
              }`}
            >
              {health.liquidityRatio <= 0 ? "—" : health.liquidityRatio >= 10 ? ">10x" : `${health.liquidityRatio.toFixed(2)}x`}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground line-clamp-1" title={health.liquidityLabel}>
            {health.liquidityLabel}
          </span>
        </div>

        {/* Ratio 3: Capital de Trabajo Operativo */}
        <div className="flex flex-col rounded-xl bg-background/80 border border-border/60 p-2.5 min-w-[125px] shadow-2xs">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            Capital Operativo
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-black ${
                health.workingCapital >= 0
                  ? "text-foreground"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatPen(health.workingCapital)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">Caja + Cobrar − Pagar</span>
        </div>
      </div>

      {/* Enlaces Rápidos a Módulos Contables Oficiales */}
      <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[11px] font-medium text-muted-foreground">
          Reportes oficiales auditables:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/accounting/income-statement"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
          >
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Estado de Resultados</span>
          </Link>
          <span className="text-border">•</span>
          <Link
            href="/accounting/balance"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
          >
            <Scale className="h-3 w-3 text-blue-500" />
            <span>Balance General</span>
          </Link>
          <span className="text-border">•</span>
          <Link
            href="/accounting/journal"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
          >
            <BookOpen className="h-3 w-3 text-purple-500" />
            <span>Libro Diario</span>
          </Link>
          <span className="text-border">•</span>
          <Link
            href="/accounting/ledger"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
          >
            <FileText className="h-3 w-3 text-amber-500" />
            <span>Libro Mayor</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
