"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle2,
  Search,
  Eye,
  CreditCard,
  Receipt,
  Plus,
  Building2,
  Calendar as CalendarIcon,
  X,
  TrendingUp,
  Percent,
  Filter,
} from "lucide-react";
import { PurchaseDetailDialog } from "./PurchaseDetailDialog";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchasePaymentItem {
  id: number;
  purchaseInvoiceId: number;
  paymentTypeId: number;
  amount: number | string;
  paidAt: string;
  paymentType: {
    id: number;
    name: string;
  };
}

export interface PurchaseOrderItemLine {
  id: number;
  supplyId: number;
  quantityOrdered: number | string;
  quantityReceived: number | string | null;
  unitPrice: number | string;
  affectationIgv: string;
  supply: {
    id: number;
    name: string;
    unitOfMeasure: string;
  };
}

export interface PurchaseInvoice {
  id: number;
  supplierId: number;
  purchaseOrderId: number;
  voucherType: string;
  series: string;
  number: number;
  issuedAt: string;
  subtotal: number | string;
  igv: number | string;
  totalAmount: number | string;
  createdAt: string;
  active: boolean;
  supplier: {
    id: number;
    ruc: string;
    businessName: string;
    contactPerson?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  purchaseOrder: {
    id: number;
    items: PurchaseOrderItemLine[];
  };
  payments: PurchasePaymentItem[];
  totalPagado: number;
  saldoPendiente: number;
  estadoPago: "Pendiente" | "Parcial" | "Pagado";
}

export interface PaymentType {
  id: number;
  name: string;
  active: boolean;
}

export type PeriodFilter = "this_month" | "today" | "this_week" | "all" | "custom";

interface PurchasesTableProps {
  initialInvoices: PurchaseInvoice[];
  paymentTypes: PaymentType[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"
];

// ─── Main component ───────────────────────────────────────────────────────────

export function PurchasesTable({ initialInvoices, paymentTypes }: PurchasesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this_month");

  // Rango personalizado
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [invoiceToView, setInvoiceToView] = useState<PurchaseInvoice | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<PurchaseInvoice | null>(null);

  // 1. Filtrado de Período (Fechas)
  const periodInvoices = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return initialInvoices.filter((inv) => {
      const invDate = new Date(inv.issuedAt);

      if (periodFilter === "today") {
        return (
          invDate.getUTCFullYear() === currentYear &&
          invDate.getUTCMonth() === currentMonth &&
          invDate.getUTCDate() === now.getDate()
        );
      }

      if (periodFilter === "this_week") {
        const diffMs = now.getTime() - invDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= -1 && diffDays <= 7;
      }

      if (periodFilter === "this_month") {
        return (
          invDate.getUTCFullYear() === currentYear &&
          invDate.getUTCMonth() === currentMonth
        );
      }

      if (periodFilter === "custom") {
        if (customStart && customEnd) {
          const start = new Date(`${customStart}T00:00:00`);
          const end = new Date(`${customEnd}T23:59:59`);
          return invDate >= start && invDate <= end;
        }
        return true;
      }

      // "all"
      return true;
    });
  }, [initialInvoices, periodFilter, customStart, customEnd]);

  // KPIs calculados sobre el período activo
  const totalCompras = periodInvoices.length;
  const montoTotal = periodInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const subtotalTotal = periodInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
  const igvTotal = periodInvoices.reduce((sum, inv) => sum + Number(inv.igv), 0);
  const totalPagadoAcumulado = periodInvoices.reduce((sum, inv) => sum + Number(inv.totalPagado), 0);
  const saldoPendienteAcumulado = periodInvoices.reduce((sum, inv) => sum + Number(inv.saldoPendiente), 0);

  const pendientesCount = periodInvoices.filter((inv) => inv.estadoPago === "Pendiente").length;
  const parcialesCount = periodInvoices.filter((inv) => inv.estadoPago === "Parcial").length;
  const pagadasCount = periodInvoices.filter((inv) => inv.estadoPago === "Pagado").length;

  const paymentRatio = montoTotal > 0 ? Math.min(100, Math.round((totalPagadoAcumulado / montoTotal) * 100)) : 0;

  // Etiqueta legible del período activo
  const periodLabel = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case "today":
        return "Hoy";
      case "this_week":
        return "Últimos 7 días";
      case "this_month":
        return `Este Mes (${MONTH_NAMES[now.getMonth()]})`;
      case "custom":
        return customStart && customEnd ? `${formatDate(customStart)} - ${formatDate(customEnd)}` : "Rango personalizado";
      default:
        return "Histórico completo";
    }
  }, [periodFilter, customStart, customEnd]);

  // 2. Filtrado final por búsqueda y estado
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return periodInvoices.filter((inv) => {
      const comprobante = `${inv.voucherType} ${inv.series}-${inv.number}`.toLowerCase();
      const proveedor = `${inv.supplier.businessName} ${inv.supplier.ruc}`.toLowerCase();
      const matchesSearch = !q || proveedor.includes(q) || comprobante.includes(q);

      let matchesStatus = true;
      if (statusFilter === "pending") matchesStatus = inv.estadoPago === "Pendiente";
      if (statusFilter === "partial") matchesStatus = inv.estadoPago === "Parcial";
      if (statusFilter === "paid") matchesStatus = inv.estadoPago === "Pagado";

      return matchesSearch && matchesStatus;
    });
  }, [periodInvoices, search, statusFilter]);

  const hasActiveFilter = search.trim() !== "" || statusFilter !== "all" || periodFilter !== "this_month";

  const handleOpenDetail = (invoice: PurchaseInvoice) => {
    setInvoiceToView(invoice);
    setDetailOpen(true);
  };

  const handleOpenPayment = (invoice: PurchaseInvoice) => {
    setInvoiceToPay(invoice);
    setPaymentOpen(true);
  };

  const handleOpenPaymentFromDetail = (invoice: PurchaseInvoice) => {
    setDetailOpen(false);
    setInvoiceToPay(invoice);
    setPaymentOpen(true);
  };

  return (
    <div className="space-y-6">

      {/* ── Barra Superior: Selector de Período y Control Temporal ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-slate-50/70 dark:bg-slate-900/40 p-3 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-foreground">Período de Análisis:</span>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-0.5 rounded-full font-mono">
            {periodLabel}
          </span>
        </div>

        {/* Botones de Selección Rápida de Período */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPeriodFilter("this_month")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
              periodFilter === "this_month"
                ? "bg-white dark:bg-slate-800 text-foreground font-semibold border-slate-300 dark:border-slate-700 shadow-2xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            }`}
          >
            Este Mes
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter("today")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
              periodFilter === "today"
                ? "bg-white dark:bg-slate-800 text-foreground font-semibold border-slate-300 dark:border-slate-700 shadow-2xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter("this_week")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
              periodFilter === "this_week"
                ? "bg-white dark:bg-slate-800 text-foreground font-semibold border-slate-300 dark:border-slate-700 shadow-2xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            }`}
          >
            7 Días
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter("all")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
              periodFilter === "all"
                ? "bg-white dark:bg-slate-800 text-foreground font-semibold border-slate-300 dark:border-slate-700 shadow-2xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            }`}
          >
            Todo
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter("custom")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
              periodFilter === "custom"
                ? "bg-white dark:bg-slate-800 text-foreground font-semibold border-slate-300 dark:border-slate-700 shadow-2xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            }`}
          >
            Personalizado...
          </button>
        </div>
      </div>

      {/* Rango de Fechas Personalizado (se muestra solo si se selecciona "custom") */}
      {periodFilter === "custom" && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 bg-card border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl shadow-2xs animate-in fade-in-50">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <Filter className="h-3.5 w-3.5" />
            <span>Definir Rango:</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Desde:</span>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 text-xs bg-background w-36"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Hasta:</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 text-xs bg-background w-36"
            />
          </div>
          {(customStart || customEnd) && (
            <button
              onClick={() => {
                setCustomStart("");
                setCustomEnd("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
            >
              Resetear rango
            </button>
          )}
        </div>
      )}

      {/* ── Dashboard Executive Cards (Dinámicas según el período activo) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Volumen de Compras */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-blue-50/20 dark:to-blue-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60 shadow-2xs">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {periodLabel}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Compras del Período</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
                {totalCompras}
              </span>
              <span className="text-xs text-muted-foreground">comprobantes</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Histórico total:</span>
            <span className="font-semibold text-foreground">{initialInvoices.length} compras</span>
          </div>
        </div>

        {/* Card 2: Monto Total Facturado */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-emerald-50/20 dark:to-emerald-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/60 shadow-2xs">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 px-2 py-0.5 rounded-full font-mono">
              PEN (S/)
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Facturación ({periodLabel})</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 font-mono">
                S/ {montoTotal.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Base: S/ {subtotalTotal.toFixed(2)}</span>
            <span>IGV: S/ {igvTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 3: Nivel de Liquidación / Pagos */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-indigo-50/20 dark:to-indigo-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
              <Percent className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 px-2 py-0.5 rounded-full font-mono">
              {paymentRatio}% Pagado
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Cuentas por Pagar ({periodLabel})</p>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${paymentRatio}%` }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Pagado: S/ {totalPagadoAcumulado.toFixed(2)}</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">Saldo: S/ {saldoPendienteAcumulado.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 4: Distribución de Estados */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-amber-50/20 dark:to-amber-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/60 shadow-2xs">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Distribución
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-emerald-800 dark:text-emerald-300 font-mono">{pagadasCount}</p>
              <p className="text-[10px] text-emerald-700 font-medium">Pagadas</p>
            </div>
            <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-amber-800 dark:text-amber-300 font-mono">{parcialesCount}</p>
              <p className="text-[10px] text-amber-700 font-medium">Parcial</p>
            </div>
            <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/50 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-rose-800 dark:text-rose-300 font-mono">{pendientesCount}</p>
              <p className="text-[10px] text-rose-700 font-medium">Pendiente</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Por liquidar en período:</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">{pendientesCount + parcialesCount} compras</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar Inteligente (Buscador + Filtros Segmentados + Botón Acción) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-card border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xs">
        
        {/* Izquierda: Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por RUC, razón social o comprobante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-10 text-xs bg-background rounded-xl border-slate-200 dark:border-slate-800"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Centro / Derecha: Segmented Control de Estados + Botón Nueva Compra */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded-full font-mono">
                {totalCompras}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "pending"
                  ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Pendientes</span>
              {pendientesCount > 0 && (
                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                  {pendientesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("partial")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "partial"
                  ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Parcial</span>
              {parcialesCount > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                  {parcialesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("paid")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "paid"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Pagadas</span>
              {pagadasCount > 0 && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                  {pagadasCount}
                </span>
              )}
            </button>
          </div>

          {/* Botón directo a Añadir Compra */}
          <Link href="/purchases/add">
            <Button
              size="sm"
              className="h-10 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Añadir Compra</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Tabla Moderna de Compras ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800">
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-28">Fecha</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[220px]">Proveedor</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[170px]">Comprobante</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-28">Subtotal</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-24">IGV</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-32">Total</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center w-36">Estado de Pago</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-28">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto">
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground">
                        <Receipt className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {hasActiveFilter
                            ? `No se encontraron compras en el período (${periodLabel}) con esos filtros`
                            : "Aún no tienes compras registradas en este período"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {hasActiveFilter
                            ? "Prueba cambiando el período de análisis, los términos de búsqueda o selecciona otro filtro de estado."
                            : "Registra tu primera compra unificada con sus insumos y comprobante fiscal."}
                        </p>
                      </div>
                      {hasActiveFilter ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("all");
                            setPeriodFilter("all");
                          }}
                          className="mt-2 text-xs rounded-xl"
                        >
                          Mostrar Todo el Histórico
                        </Button>
                      ) : (
                        <Link href="/purchases/add">
                          <Button size="sm" className="mt-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> Registrar Primera Compra
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => {
                  const subtotal = Number(inv.subtotal);
                  const igv = Number(inv.igv);
                  const total = Number(inv.totalAmount);
                  const saldo = Number(inv.saldoPendiente);

                  const isFactura = inv.voucherType.toLowerCase().includes("factura");

                  return (
                    <TableRow key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                      
                      {/* Fecha */}
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{formatDate(inv.issuedAt)}</span>
                        </div>
                      </TableCell>

                      {/* Proveedor */}
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-blue-50/80 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100/70">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">
                              {inv.supplier.businessName}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {inv.supplier.ruc.length === 8 ? "DNI:" : "RUC:"} {inv.supplier.ruc}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Comprobante */}
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                              isFactura
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {inv.voucherType}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {inv.series}-{inv.number}
                          </span>
                        </div>
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground font-medium">
                        S/ {subtotal.toFixed(2)}
                      </TableCell>

                      {/* IGV */}
                      <TableCell className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">
                        S/ {igv.toFixed(2)}
                      </TableCell>

                      {/* Total */}
                      <TableCell className="py-3.5 px-4 text-right font-mono text-xs font-bold">
                        <span className="bg-slate-100 dark:bg-slate-800 text-foreground px-2 py-1 rounded-md">
                          S/ {total.toFixed(2)}
                        </span>
                      </TableCell>

                      {/* Estado de Pago */}
                      <TableCell className="py-3.5 px-4 text-center">
                        {inv.estadoPago === "Pagado" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Pagado
                          </span>
                        )}
                        {inv.estadoPago === "Parcial" && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100/80 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                              Parcial
                            </span>
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono font-medium mt-0.5">
                              Resta S/ {saldo.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {inv.estadoPago === "Pendiente" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100/80 text-rose-900 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            Pendiente
                          </span>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(inv)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 transition-all"
                            title="Ver detalle completo"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-600" />
                            <span className="hidden xl:inline">Detalle</span>
                          </Button>
                          
                          {inv.estadoPago !== "Pagado" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPayment(inv)}
                              className="h-8 px-2.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 border border-blue-200/80 dark:border-blue-800 rounded-lg flex items-center gap-1 transition-all shadow-2xs"
                              title="Registrar abono o pago"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Pagar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {invoiceToView && (
        <PurchaseDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          invoice={invoiceToView}
          onRegisterPayment={handleOpenPaymentFromDetail}
        />
      )}

      {invoiceToPay && (
        <RegisterPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          invoice={invoiceToPay}
          paymentTypes={paymentTypes}
        />
      )}
    </div>
  );
}
