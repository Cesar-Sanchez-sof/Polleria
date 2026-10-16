"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  CreditCard,
  Users,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import type { Kpi, KpiKey } from "@/lib/services/dashboard.service";
import { formatPen } from "@/lib/services/dashboard.service";

function formatValue(kpi: Kpi): string {
  if (kpi.kind === "count") return new Intl.NumberFormat("es-PE").format(kpi.value);
  return formatPen(kpi.value);
}

interface KpiConfig {
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
  borderAccent: string;
  badgeBg: string;
  accentText: string;
  description: string;
  reportLink?: { href: string; label: string };
  invertVariationColor?: boolean;
}

const KPI_CONFIG: Record<KpiKey, KpiConfig> = {
  income: {
    icon: TrendingUp,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    glowColor: "bg-emerald-500/10",
    borderAccent: "border-emerald-500/30 hover:border-emerald-500/60",
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    accentText: "text-emerald-600 dark:text-emerald-400",
    description: "Ventas y rentas del período (PCGE Clase 7)",
    reportLink: { href: "/accounting/reports/income-statement", label: "Ver Estado de Resultados" },
  },
  expenses: {
    icon: Receipt,
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    glowColor: "bg-rose-500/10",
    borderAccent: "border-rose-500/30 hover:border-rose-500/60",
    badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    accentText: "text-rose-600 dark:text-rose-400",
    description: "Gastos operativos y compras (PCGE Clases 6 y 9)",
    reportLink: { href: "/accounting/reports/income-statement", label: "Ver Detalle de Gastos" },
    invertVariationColor: true, // Si el gasto sube, es negativo en control de costos
  },
  profit: {
    icon: Wallet,
    gradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
    glowColor: "bg-blue-500/10",
    borderAccent: "border-blue-500/30 hover:border-blue-500/60",
    badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    accentText: "text-blue-600 dark:text-blue-400",
    description: "Resultado neto del período (Ingresos − Gastos)",
    reportLink: { href: "/accounting/reports/income-statement", label: "Ver P&L Completo" },
  },
  caja_bancos: {
    icon: Landmark,
    gradient: "from-teal-500/10 via-teal-500/5 to-transparent",
    glowColor: "bg-teal-500/10",
    borderAccent: "border-teal-500/30 hover:border-teal-500/60",
    badgeBg: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    accentText: "text-teal-600 dark:text-teal-400",
    description: "Efectivo y depósitos bancarios acumulados (Cta. 10)",
    reportLink: { href: "/accounting/reports/balance", label: "Ver Balance General" },
  },
  por_cobrar: {
    icon: Users,
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    glowColor: "bg-amber-500/10",
    borderAccent: "border-amber-500/30 hover:border-amber-500/60",
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    accentText: "text-amber-600 dark:text-amber-400",
    description: "Derechos de cobro a clientes acumulados (Cta. 12)",
    reportLink: { href: "/accounting/reports/balance", label: "Ver Cuentas por Cobrar" },
  },
  por_pagar: {
    icon: CreditCard,
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    glowColor: "bg-purple-500/10",
    borderAccent: "border-purple-500/30 hover:border-purple-500/60",
    badgeBg: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    accentText: "text-purple-600 dark:text-purple-400",
    description: "Obligaciones comerciales con proveedores (Cta. 42)",
    reportLink: { href: "/accounting/reports/balance", label: "Ver Cuentas por Pagar" },
    invertVariationColor: true,
  },
  entries: {
    icon: FileSpreadsheet,
    gradient: "from-slate-500/10 via-slate-500/5 to-transparent",
    glowColor: "bg-slate-500/10",
    borderAccent: "border-slate-400/30 hover:border-slate-500/60",
    badgeBg: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    accentText: "text-slate-600 dark:text-slate-400",
    description: "Asientos contables vigentes asentados en el rango",
    reportLink: { href: "/accounting/journal", label: "Ver Libro Diario" },
  },
};

function VariationBadge({
  kpi,
  invertColors = false,
}: {
  kpi: Kpi;
  invertColors?: boolean;
}) {
  if (kpi.variation === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        Sin histórico
      </span>
    );
  }

  const { percent, direction } = kpi.variation;
  const isUp = direction === "up";
  const isNeutral = direction === "flat";

  // Lógica de color contable:
  // Para gastos o deudas, subir es desfavorable (rojo), bajar es favorable (verde)
  let toneClass = "bg-muted text-muted-foreground";
  if (!isNeutral) {
    if (invertColors) {
      toneClass = isUp
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    } else {
      toneClass = isUp
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    }
  }

  const Icon = isUp ? ArrowUpRight : isNeutral ? Minus : ArrowDownRight;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${toneClass}`}
      title={`Variación del ${percent > 0 ? "+" : ""}${percent}% respecto al período anterior de igual duración`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(percent).toLocaleString("es-PE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })}
      %
    </span>
  );
}

interface DashboardKpisProps {
  kpis: Kpi[];
}

export function DashboardKpis({ kpis }: Readonly<DashboardKpisProps>) {
  // Dividimos en dos grupos conceptuales para mejor lectura financiera
  const pnlKeys: KpiKey[] = ["income", "expenses", "profit"];
  const balanceKeys: KpiKey[] = ["caja_bancos", "por_cobrar", "por_pagar", "entries"];

  const pnlKpis = kpis.filter((k) => pnlKeys.includes(k.key));
  const balanceKpis = kpis.filter((k) => balanceKeys.includes(k.key));

  const renderKpiCard = (kpi: Kpi) => {
    const isLoss = kpi.key === "profit" && kpi.value < 0;
    const isZeroRevenue = kpi.key === "income" && kpi.value === 0;
    const config = KPI_CONFIG[kpi.key] ?? {
      icon: HelpCircle,
      gradient: "from-slate-500/10 to-transparent",
      glowColor: "bg-slate-500/10",
      borderAccent: "border-border",
      badgeBg: "bg-muted text-muted-foreground",
      accentText: "text-foreground",
      description: kpi.label,
    };

    const Icon = config.icon;
    const isExpenseCard = kpi.key === "expenses";
    const isDebtCard = kpi.key === "por_pagar";

    return (
      <div
        key={kpi.key}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 sm:p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
          isLoss
            ? "border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent"
            : `bg-gradient-to-br ${config.gradient} ${config.borderAccent}`
        }`}
      >
        {/* Glow de fondo interactivo */}
        <div
          className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-all duration-500 group-hover:scale-125 ${
            isLoss ? "bg-rose-500/20" : config.glowColor
          }`}
        />

        {/* Encabezado de la tarjeta */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-2xs transition-transform duration-300 group-hover:scale-110 ${
                isLoss ? "bg-rose-500/20 text-rose-600" : `${config.badgeBg}`
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground tracking-tight block">
                {kpi.label}
              </span>
              <span className="text-[10px] text-muted-foreground block line-clamp-1">
                {config.description}
              </span>
            </div>
          </div>
          <VariationBadge
            kpi={kpi}
            invertColors={config.invertVariationColor}
          />
        </div>

        {/* Valor numérico principal */}
        <div className="relative z-10 my-3 flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight truncate ${
                isLoss
                  ? "text-rose-600 dark:text-rose-400"
                  : isZeroRevenue
                  ? "text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {isLoss
                ? `−${formatValue({ ...kpi, value: Math.abs(kpi.value) })}`
                : formatValue(kpi)}
            </span>
          </div>
        </div>

        {/* Enlace de auditoría y desglose */}
        {config.reportLink ? (
          <div className="relative z-10 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
            <Link
              href={config.reportLink.href}
              className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-primary group-hover:underline"
            >
              <span>{config.reportLink.label}</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Sección 1: Resultados del Período (P&L) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rendimiento Operativo (Estado de Resultados)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Flujo acumulado del rango
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {pnlKpis.map(renderKpiCard)}
        </div>
      </div>

      {/* Sección 2: Posición Financiera & Liquidez (Balance Acumulado) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Posición Patrimonial & Liquidez (Balance Acumulado)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Saldos a la fecha de corte
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {balanceKpis.map(renderKpiCard)}
        </div>
      </div>
    </div>
  );
}
