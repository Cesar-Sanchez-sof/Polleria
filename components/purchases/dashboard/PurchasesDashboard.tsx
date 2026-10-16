"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Boxes,
  Package,
  Repeat,
  Sparkles,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  ListOrdered,
  Percent,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
  Users,
  Wheat,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { SupplyType } from "@prisma/client";
import { StatCard } from "@/components/shared/StatCard";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/shared/SegmentedTabs";
import type { PurchaseInvoice } from "@/components/purchases/list/PurchasesTable";
import type { Supplier } from "@/components/purchases/suppliers/SuppliersTable";
import type { TransformationDetailRecord } from "@/components/purchases/transformation/TransformationDetailDialog";

interface DashboardSupply {
  id: number;
  name: string;
  type: SupplyType;
  unitOfMeasure: string;
  currentStock: number | string;
  minimumStock: number | string;
  lastCost?: number | string | null;
  averageCost?: number | string | null;
}

interface PurchasesDashboardProps {
  invoices: PurchaseInvoice[];
  supplies: DashboardSupply[];
  suppliers: Supplier[];
  transformations: TransformationDetailRecord[];
}

type Period = "this_month" | "today" | "this_week" | "all";

const PERIOD_TABS: SegmentedTabItem<Period>[] = [
  { value: "this_month", label: "Este Mes" },
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "7 Días" },
  { value: "all", label: "Todo" },
];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

const FLAT = { enableGradient: false, enableHover: false } as const;

function Section({ icon: Icon, title, subtitle, action, children }: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-4">
            <Icon />
          </div>
          <div>
            <h2 className="text-sm font-bold leading-tight text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PurchasesDashboard({ invoices, supplies, suppliers, transformations }: PurchasesDashboardProps) {
  const [period, setPeriod] = useState<Period>("this_month");

  // ── Compras ────────────────────────────────────────────────────────────────
  const periodInvoices = useMemo(() => {
    const now = new Date();
    return invoices.filter((inv) => {
      const date = new Date(inv.issuedAt);
      if (period === "today") {
        return (
          date.getUTCFullYear() === now.getFullYear() &&
          date.getUTCMonth() === now.getMonth() &&
          date.getUTCDate() === now.getDate()
        );
      }
      if (period === "this_week") {
        const days = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        return days >= -1 && days <= 7;
      }
      if (period === "this_month") {
        return date.getUTCFullYear() === now.getFullYear() && date.getUTCMonth() === now.getMonth();
      }
      return true;
    });
  }, [invoices, period]);

  const periodLabel =
    period === "today" ? "Hoy"
    : period === "this_week" ? "Últimos 7 días"
    : period === "this_month" ? `Este Mes (${MONTH_NAMES[new Date().getMonth()]})`
    : "Histórico completo";

  const sum = (pick: (inv: PurchaseInvoice) => number | string) =>
    periodInvoices.reduce((total, inv) => total + Number(pick(inv)), 0);
  const totalAmount = sum((inv) => inv.totalAmount);
  const subtotal = sum((inv) => inv.subtotal);
  const igv = sum((inv) => inv.igv);
  const totalPaid = sum((inv) => inv.totalPaid);
  const pendingBalance = sum((inv) => inv.pendingBalance);
  const paymentRatio = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;
  const paidCount = periodInvoices.filter((inv) => inv.paymentStatus === "Pagado").length;
  const partialCount = periodInvoices.filter((inv) => inv.paymentStatus === "Parcial").length;
  const pendingCount = periodInvoices.filter((inv) => inv.paymentStatus === "Pendiente").length;

  // ── Inventario ─────────────────────────────────────────────────────────────
  const totalSupplies = supplies.length;
  const rawMaterials = supplies.filter((s) => s.type === SupplyType.RawMaterial).length;
  const finishedProducts = supplies.filter((s) => s.type === SupplyType.FinishedProduct).length;
  const lowStockItems = supplies.filter((s) => Number(s.currentStock) <= Number(s.minimumStock));
  const lowStockCount = lowStockItems.length;
  const inventoryValue = supplies.reduce(
    (total, s) => total + Number(s.currentStock) * Number(s.averageCost || s.lastCost || 0),
    0,
  );
  const healthPct = totalSupplies === 0 ? 100 : Math.round(((totalSupplies - lowStockCount) / totalSupplies) * 100);
  const rawPct = totalSupplies === 0 ? 0 : Math.round((rawMaterials / totalSupplies) * 100);
  const finishedPct = totalSupplies === 0 ? 0 : 100 - rawPct;

  const healthTone =
    healthPct >= 80 ? "text-emerald-700 dark:text-emerald-400"
    : healthPct >= 50 ? "text-amber-700 dark:text-amber-400"
    : "text-rose-700 dark:text-rose-400";

  // ── Proveedores ────────────────────────────────────────────────────────────
  const activeSuppliers = suppliers.filter((p) => p.active).length;
  const withRuc = suppliers.filter((p) => p.ruc.length === 11).length;
  const withDni = suppliers.filter((p) => p.ruc.length === 8).length;

  const topSupplier = useMemo(() => {
    const totals = new Map<number, { name: string; ruc: string; total: number; count: number }>();
    for (const inv of invoices) {
      const supplier = suppliers.find((s) => s.id === inv.supplierId) ?? inv.supplier;
      const entry = totals.get(inv.supplierId) ?? {
        name: supplier?.businessName || `Proveedor #${inv.supplierId}`,
        ruc: supplier?.ruc || "",
        total: 0,
        count: 0,
      };
      entry.total += Number(inv.totalAmount);
      entry.count += 1;
      totals.set(inv.supplierId, entry);
    }
    return [...totals.values()].sort((a, b) => b.total - a.total)[0] ?? null;
  }, [invoices, suppliers]);

  const cashCount = invoices.filter((v) => v.paymentStatus === "Pagado" && Number(v.pendingBalance) === 0).length;
  const creditCount = invoices.length - cashCount;
  const cashRatio = invoices.length > 0 ? Math.round((cashCount / invoices.length) * 100) : 100;

  const openInvoices = invoices.filter((v) => Number(v.pendingBalance) > 0.005);
  const totalDebt = openInvoices.reduce((total, v) => total + Number(v.pendingBalance), 0);
  const suppliersWithDebt = new Set(openInvoices.map((v) => v.supplierId)).size;

  // ── Transformación ─────────────────────────────────────────────────────────
  const activeTransformations = transformations.filter((tr) => !tr.annulled);
  const annulledTransformations = transformations.length - activeTransformations.length;
  const quantityOf = (itemType: string) =>
    activeTransformations.reduce(
      (total, tr) =>
        total +
        tr.items.filter((i) => i.itemType === itemType).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
      0,
    );
  const unitsConsumed = quantityOf("Consumo");
  const unitsProduced = quantityOf("Producido");

  const distribution = [
    { label: "Pagadas", count: paidCount, cls: "border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300" },
    { label: "Parcial", count: partialCount, cls: "border-amber-200/70 bg-amber-50/80 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300" },
    { label: "Pendiente", count: pendingCount, cls: "border-rose-200/70 bg-rose-50/80 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* ── Sección: Compras ── */}
      <Section
        icon={ShoppingCart}
        title="Compras"
        subtitle={`Comprobantes, facturación y pagos · ${periodLabel}`}
        action={
          <SegmentedTabs
            items={PERIOD_TABS}
            value={period}
            onValueChange={setPeriod}
            size="sm"
            rounded="lg"
            enableCount={false}
            ariaLabel="Período de análisis"
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            {...FLAT}
            tone="blue"
            icon={<ShoppingCart />}
            badge={periodLabel}
            badgeIcon={<TrendingUp />}
            label="Compras del Período"
            value={periodInvoices.length}
            unit="comprobantes"
            footerLeft="Histórico total:"
            footerRight={`${invoices.length} compras`}
          />
          <StatCard
            {...FLAT}
            tone="emerald"
            icon={<DollarSign />}
            badge="PEN (S/)"
            badgeMono
            label={`Facturación (${periodLabel})`}
            value={`S/ ${totalAmount.toFixed(2)}`}
            colorValue
            footerLeft={`Base: S/ ${subtotal.toFixed(2)}`}
            footerRight={`IGV: S/ ${igv.toFixed(2)}`}
          />
          <StatCard
            {...FLAT}
            tone="indigo"
            icon={<Percent />}
            badge={`${paymentRatio}% Pagado`}
            badgeMono
            label={`Cuentas por Pagar (${periodLabel})`}
            progress={paymentRatio}
            footerLeft={`Pagado: S/ ${totalPaid.toFixed(2)}`}
            footerRight={`Saldo: S/ ${pendingBalance.toFixed(2)}`}
          />
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-card p-5 shadow-xs dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-400 [&_svg]:size-5">
                <Clock />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Estado de pago ({periodLabel})</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {distribution.map((item) => (
                <div key={item.label} className={`rounded-xl border p-2 text-center ${item.cls}`}>
                  <p className="font-mono text-base font-bold">{item.count}</p>
                  <p className="text-[10px] font-medium">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-muted-foreground dark:border-slate-800/80">
              <span>Por liquidar en período:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{pendingCount + partialCount} compras</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Sección: Inventario ── */}
      <Section
        icon={Boxes}
        title="Inventario"
        subtitle="Salud del almacén, categorías y alertas de reabastecimiento"
        action={
          <Link href="/purchases/inventory" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Ver inventario
          </Link>
        }
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-xs dark:border-slate-800">
          <div className="grid grid-cols-1 divide-y divide-slate-200/80 dark:divide-slate-800 md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="flex flex-col gap-4 p-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salud del Almacén</span>
              <div className="flex items-center gap-5">
                <div className="relative h-16 w-16 shrink-0">
                  <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="6" />
                    <circle
                      cx="28" cy="28" r="22" fill="none"
                      stroke={healthPct >= 80 ? "#10b981" : healthPct >= 50 ? "#f59e0b" : "#f43f5e"}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${(healthPct / 100) * 138.2} 138.2`}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center font-mono text-sm font-black ${healthTone}`}>{healthPct}%</span>
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-foreground">
                    {healthPct >= 80 ? "Stock saludable" : healthPct >= 50 ? "Atención requerida" : "Estado crítico"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {totalSupplies - lowStockCount} de {totalSupplies} insumos sobre mínimo
                  </p>
                  <p className="mt-2 font-mono text-xs font-semibold text-muted-foreground">
                    Valor est. almacén: <span className="text-foreground">S/ {inventoryValue.toFixed(2)}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distribución por Categoría</span>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300"><Wheat className="h-3 w-3" /> Materias Primas</span>
                    <span className="font-mono font-bold text-amber-800 dark:text-amber-300">{rawMaterials} <span className="font-normal text-muted-foreground">/ {totalSupplies}</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-950/40">
                    <div className="h-full rounded-full bg-amber-400 transition-all duration-700 dark:bg-amber-500" style={{ width: `${rawPct}%` }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-orange-800 dark:text-orange-300"><UtensilsCrossed className="h-3 w-3" /> Prod. Terminados</span>
                    <span className="font-mono font-bold text-orange-800 dark:text-orange-300">{finishedProducts} <span className="font-normal text-muted-foreground">/ {totalSupplies}</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/40">
                    <div className="h-full rounded-full bg-orange-400 transition-all duration-700 dark:bg-orange-500" style={{ width: `${finishedPct}%` }} />
                  </div>
                </div>
                <p className="border-t border-slate-100 pt-1 text-[11px] text-muted-foreground dark:border-slate-800">
                  {rawPct}% materias primas · {finishedPct}% terminados
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alertas de Reabastecimiento</span>
                <div className="flex items-center gap-1.5">
                  {lowStockCount > 0 && (
                    <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300">
                      {lowStockCount} crítico{lowStockCount > 1 ? "s" : ""}
                    </span>
                  )}
                  <Link href="/purchases/inventory" className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                    <ListOrdered className="h-3 w-3" /> Kardex
                  </Link>
                </div>
              </div>
              {lowStockCount === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 dark:text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Todo bajo control</p>
                  <p className="text-[11px] text-muted-foreground">Ningún insumo está por debajo de su nivel mínimo.</p>
                </div>
              ) : (
                <div className="max-h-[120px] space-y-1.5 overflow-y-auto pr-1">
                  {lowStockItems.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-rose-200/60 bg-rose-50/70 px-2.5 py-1.5 dark:border-rose-800/40 dark:bg-rose-950/30">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <TrendingDown className="h-3 w-3 shrink-0 text-rose-500" />
                        <span className="truncate text-xs font-semibold text-rose-900 dark:text-rose-200">{s.name}</span>
                      </div>
                      <span className="shrink-0 rounded bg-rose-100 px-1.5 font-mono text-[10px] text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                        -{(Number(s.minimumStock) - Number(s.currentStock)).toFixed(1)} {s.unitOfMeasure}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Sección: Proveedores ── */}
      <Section
        icon={Users}
        title="Proveedores"
        subtitle="Padrón, volumen de compra, modalidad de pago y deuda viva"
        action={
          <Link href="/purchases/suppliers" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Ver proveedores
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            {...FLAT}
            tone="amber"
            icon={<Building2 />}
            badge="Padrón Comercial"
            label="Directorio de Proveedores"
            value={suppliers.length}
            unit="registrados"
            footerLeft={`${activeSuppliers} activos`}
            footerRight={`${withRuc} con RUC • ${withDni} con DNI`}
          />
          <StatCard
            {...FLAT}
            tone="amber"
            icon={<Trophy />}
            badge="Top Proveedor"
            badgeIcon={<TrendingUp />}
            label="Mayor Volumen de Compra"
            value={topSupplier ? topSupplier.name : "Sin compras aún"}
            footerLeft={topSupplier ? `S/ ${topSupplier.total.toFixed(2)} (${topSupplier.count} compras)` : "S/ 0.00"}
            footerRight={topSupplier?.ruc ? `RUC: ${topSupplier.ruc}` : "Esperando compras"}
          />
          <StatCard
            {...FLAT}
            tone="neutral"
            icon={<CreditCard />}
            badge={`${cashRatio}% Contado`}
            badgeMono
            label="Modalidad de Operaciones"
            progress={cashRatio}
            footerLeft={`Contado: ${cashCount} op.`}
            footerRight={`Crédito: ${creditCount} op.`}
          />
          <StatCard
            {...FLAT}
            tone="rose"
            icon={<AlertCircle />}
            badge="Cuentas x Pagar"
            label="Deuda Viva con Proveedores"
            value={`S/ ${totalDebt.toFixed(2)}`}
            colorValue
            footerLeft={`${suppliersWithDebt} proveedores con saldo`}
            footerRight={`${openInvoices.length} facturas pendientes`}
          />
        </div>
      </Section>

      {/* ── Sección: Transformación ── */}
      <Section
        icon={Repeat}
        title="Transformación"
        subtitle="Lotes de producción: materia prima consumida y productos generados"
        action={
          <Link href="/purchases/transformation" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Ver transformaciones
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            {...FLAT}
            tone="amber"
            icon={<Repeat />}
            badge="Operaciones"
            label="Lotes Ejecutados"
            value={transformations.length}
            unit="lotes totales"
            footerLeft={`Activas: ${activeTransformations.length}`}
            footerRight="Histórico total"
          />
          <StatCard
            {...FLAT}
            tone="rose"
            icon={<Package />}
            badge="Salida Stock"
            badgeMono
            label="Materia Prima Consumida"
            value={unitsConsumed.toFixed(2)}
            unit="cant. total"
            colorValue
            footerLeft="Insumos descontados"
            footerRight="Consumo efectivo"
          />
          <StatCard
            {...FLAT}
            tone="emerald"
            icon={<Sparkles />}
            badge="Entrada Stock"
            badgeMono
            label="Productos Producidos"
            value={unitsProduced.toFixed(2)}
            unit="cant. generada"
            colorValue
            footerLeft="Listos para cocina / venta"
            footerRight="Rendimiento"
          />
          <StatCard
            {...FLAT}
            tone="neutral"
            icon={<Ban />}
            badge="Auditoría"
            label="Lotes Anulados"
            value={annulledTransformations}
            unit="revertidos"
            footerLeft="Reversión de Kardex"
            footerRight={annulledTransformations === 0 ? "Sin anulaciones" : "Histórico"}
          />
        </div>
      </Section>
    </div>
  );
}
