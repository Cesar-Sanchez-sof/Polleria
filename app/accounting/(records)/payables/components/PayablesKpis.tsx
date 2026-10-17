"use client";

import { CreditCard, Building2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import type { PayablesSummary } from "@/lib/services/accounting-payables.service";

interface PayablesKpisProps {
  summary: PayablesSummary;
}

const FLAT = { enableGradient: false, enableHover: false } as const;

const money = (value: number) =>
  `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PayablesKpis({ summary }: Readonly<PayablesKpisProps>) {
  const overdue = summary.overdueCount > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        {...FLAT}
        tone="amber"
        icon={<CreditCard />}
        label="Deuda Pendiente (Cta. 42)"
        value={money(summary.totalPendingDebt)}
        footerLeft={`${summary.pendingCount + summary.partialCount} comprobantes por cancelar`}
      />
      <StatCard
        {...FLAT}
        tone="blue"
        icon={<Building2 />}
        label="Proveedores con Deuda"
        value={summary.suppliersWithDebtCount}
        footerLeft="Acreedores comerciales activos"
      />
      <StatCard
        {...FLAT}
        tone="emerald"
        icon={<CheckCircle2 />}
        label="Total Amortizado"
        value={money(summary.totalPaid)}
        colorValue
        footerLeft="Tasa de cumplimiento:"
        footerRight={`${summary.paymentComplianceRate}%`}
      />
      <StatCard
        {...FLAT}
        tone={overdue ? "rose" : "emerald"}
        icon={overdue ? <AlertTriangle /> : <Clock />}
        label="Compromisos Vencidos"
        value={summary.overdueCount}
        colorValue={overdue}
        footerLeft={overdue ? "Mayor a 30 días de plazo" : "Todos los pasivos al día"}
      />
    </div>
  );
}
