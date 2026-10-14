"use client";

import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Scale,
  TrendingUp,
  CreditCard,
  FileText,
  BookOpen,
  ArrowRight,
  Landmark,
} from "lucide-react";
import { formatPen } from "@/lib/services/dashboard.service";
import type { DashboardPayload } from "@/lib/services/dashboard.service";
import { calculateFinancialHealth } from "./dashboard-utils";

interface FinancialHealthBannerProps {
  payload: DashboardPayload | null;
}

export function FinancialHealthBanner({ payload }: Readonly<FinancialHealthBannerProps>) {
  const health = calculateFinancialHealth(payload);
  if (!health || !payload) return null;

  const isProfitable = health.margin > 0;
  const isHealthyLiquidity = health.liquidityStatus === "healthy";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Lado izquierdo: Diagnóstico Ejecutivo */}
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
              isProfitable
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            }`}
          >
            {isProfitable ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Diagnóstico Financiero del Período
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  health.marginStatus === "excellent"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : health.marginStatus === "good"
                    ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                    : health.marginStatus === "tight"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                }`}
              >
                {health.marginLabel}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {health.summaryText}
            </p>
          </div>
        </div>

        {/* Lado derecho: Ratios Clave de Gestión */}
        <div className="flex flex-wrap items-center gap-3 pt-3 lg:pt-0 lg:border-l lg:border-border/60 lg:pl-5 shrink-0">
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
