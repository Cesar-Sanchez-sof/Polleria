"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import {
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import type { PayablesSummary } from "@/lib/services/accounting-payables.service";

interface PayablesKpisProps {
  summary: PayablesSummary;
}

export function PayablesKpis({ summary }: PayablesKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Saldo Pendiente (Cta. 42) */}
      <Card className="p-4 bg-white dark:bg-card border-border/80 shadow-xs rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Deuda Pendiente (Cta. 42)
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            S/ {summary.totalPendingDebt.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {summary.pendingCount + summary.partialCount}
            </span>{" "}
            comprobantes por cancelar
          </p>
        </div>
      </Card>

      {/* 2. Proveedores Acreedores */}
      <Card className="p-4 bg-white dark:bg-card border-border/80 shadow-xs rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Proveedores con Deuda
          </span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {summary.suppliersWithDebtCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span>Acreedores comerciales activos</span>
          </p>
        </div>
      </Card>

      {/* 3. Total Amortizado / Pagado */}
      <Card className="p-4 bg-white dark:bg-card border-border/80 shadow-xs rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Amortizado
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            S/ {summary.totalPaid.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Tasa de cumplimiento:</span>
            <span className="font-semibold text-emerald-600 font-mono">
              {summary.paymentComplianceRate}%
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Vencimiento / Estado de Cartera */}
      <Card className="p-4 bg-white dark:bg-card border-border/80 shadow-xs rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Compromisos Vencidos
          </span>
          <div className={`p-2 rounded-lg ${summary.overdueCount > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"}`}>
            {summary.overdueCount > 0 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl font-bold font-mono tracking-tight ${summary.overdueCount > 0 ? "text-rose-600" : "text-foreground"}`}>
            {summary.overdueCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.overdueCount > 0 ? (
              <span className="text-rose-600 font-medium">Mayor a 30 días de plazo</span>
            ) : (
              <span className="text-emerald-600 font-medium">Todos los pasivos al día</span>
            )}
          </p>
        </div>
      </Card>
    </div>
  );
}
