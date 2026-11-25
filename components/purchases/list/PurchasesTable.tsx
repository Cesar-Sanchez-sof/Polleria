"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  CreditCard,
  Receipt,
  Plus,
  Building2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { PurchaseDetailDialog } from "./PurchaseDetailDialog";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/shared/SegmentedTabs";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { AdvancedFilterToggle } from "@/components/shared/AdvancedFilterToggle";
import { AdvancedFilterBar } from "@/components/shared/AdvancedFilterBar";

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
  productId: number;
  quantityOrdered: number | string;
  quantityReceived: number | string | null;
  unitPrice: number | string;
  affectationIgv: string;
  product: {
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
    employee?: {
      id: number;
      firstName: string;
      paternalLastName?: string | null;
      maternalLastName?: string | null;
    } | null;
    receivedBy?: {
      id: number;
      firstName: string;
      paternalLastName?: string | null;
      maternalLastName?: string | null;
    } | null;
    items: PurchaseOrderItemLine[];
  };
  payments: PurchasePaymentItem[];
  totalPaid: number;
  pendingBalance: number;
  paymentStatus: "Pendiente" | "Parcial" | "Pagado";
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

const PERIOD_TABS: SegmentedTabItem<PeriodFilter>[] = [
  { value: "this_month", label: "Este Mes" },
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "7 Días" },
  { value: "all", label: "Todo" },
  { value: "custom", label: "Personalizado..." },
];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"
];

// ─── Main component ───────────────────────────────────────────────────────────

export function PurchasesTable({ initialInvoices, paymentTypes }: PurchasesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this_month");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Paginación

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
  const totalPurchases = periodInvoices.length;

  const pendingCount = periodInvoices.filter((inv) => inv.paymentStatus === "Pendiente").length;
  const partialCount = periodInvoices.filter((inv) => inv.paymentStatus === "Parcial").length;
  const paidCount = periodInvoices.filter((inv) => inv.paymentStatus === "Pagado").length;

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
      const voucher = `${inv.voucherType} ${inv.series}-${inv.number}`.toLowerCase();
      const supplier = `${inv.supplier.businessName} ${inv.supplier.ruc}`.toLowerCase();
      const orderEmployee = inv.purchaseOrder.employee;
      const employee = orderEmployee ? `${orderEmployee.firstName} ${orderEmployee.paternalLastName || ""}`.toLowerCase() : "";
      const matchesSearch = !q || supplier.includes(q) || voucher.includes(q) || employee.includes(q);

      let matchesStatus = true;
      if (statusFilter === "pending") matchesStatus = inv.paymentStatus === "Pendiente";
      if (statusFilter === "partial") matchesStatus = inv.paymentStatus === "Parcial";
      if (statusFilter === "paid") matchesStatus = inv.paymentStatus === "Pagado";

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

  const columns: DataTableColumn<PurchaseInvoice>[] = [
    {
      key: "date",
      header: "Fecha",
      width: "w-28",
      sortable: true,
      sortValue: (inv) => new Date(inv.issuedAt).getTime(),
      cell: (inv) => (
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{formatDate(inv.issuedAt)}</span>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      width: "min-w-[220px]",
      sortable: true,
      sortValue: (inv) => inv.supplier.businessName,
      primary: {
        title: (inv) => inv.supplier.businessName,
        subtitle: (inv) => `${inv.supplier.ruc.length === 8 ? "DNI:" : "RUC:"} ${inv.supplier.ruc}`,
        icon: <Building2 />,
      },
    },
    {
      key: "voucher",
      header: "Comprobante",
      width: "min-w-[170px]",
      cell: (inv) => (
        <div className="flex items-center gap-2">
          <Tag tone={inv.voucherType.toLowerCase().includes("factura") ? "blue" : "amber"}>{inv.voucherType}</Tag>
          <span className="font-mono text-xs font-bold text-foreground">
            {inv.series}-{inv.number}
          </span>
        </div>
      ),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      align: "right",
      width: "w-28",
      sortable: true,
      sortValue: (inv) => Number(inv.subtotal),
      cellClassName: "font-mono text-xs font-medium text-muted-foreground",
      cell: (inv) => `S/ ${Number(inv.subtotal).toFixed(2)}`,
    },
    {
      key: "igv",
      header: "IGV",
      align: "right",
      width: "w-24",
      cellClassName: "font-mono text-xs text-muted-foreground",
      cell: (inv) => `S/ ${Number(inv.igv).toFixed(2)}`,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      width: "w-32",
      sortable: true,
      sortValue: (inv) => Number(inv.totalAmount),
      cellClassName: "font-mono text-xs font-bold",
      cell: (inv) => (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-foreground dark:bg-slate-800">
          S/ {Number(inv.totalAmount).toFixed(2)}
        </span>
      ),
    },
    {
      key: "registeredBy",
      header: "Registrado por",
      width: "min-w-[150px]",
      cell: (inv) =>
        inv.purchaseOrder?.employee ? (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {inv.purchaseOrder.employee.firstName} {inv.purchaseOrder.employee.paternalLastName || ""}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "paymentStatus",
      header: "Estado de Pago",
      align: "center",
      width: "w-36",
      sortable: true,
      sortValue: (inv) => inv.paymentStatus,
      cell: (inv) => (
        <StatusBadge
          tone={inv.paymentStatus === "Pagado" ? "success" : inv.paymentStatus === "Parcial" ? "warning" : "danger"}
          size={inv.paymentStatus === "Parcial" ? "sm" : "md"}
          pulse={inv.paymentStatus === "Pagado"}
          detail={inv.paymentStatus === "Parcial" ? `Resta S/ ${Number(inv.pendingBalance).toFixed(2)}` : undefined}
        >
          {inv.paymentStatus}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-28",
      cell: (inv) => (
        <RowActions
          mode="both"
          size="sm"
          actions={[
            { key: "detail", label: "Detalle", icon: <Eye />, tone: "blue", onClick: () => handleOpenDetail(inv) },
            {
              key: "pay",
              label: "Pagar",
              icon: <CreditCard />,
              tone: "blue",
              hidden: inv.paymentStatus === "Pagado",
              onClick: () => handleOpenPayment(inv),
            },
          ]}
        />
      ),
    },
  ];

  const statusTabs: SegmentedTabItem<"all" | "pending" | "partial" | "paid">[] = [
    { value: "all", label: "Todos", count: totalPurchases },
    { value: "pending", label: "Pendientes", count: pendingCount, tone: "danger" },
    { value: "partial", label: "Parcial", count: partialCount, tone: "warning" },
    { value: "paid", label: "Pagadas", count: paidCount, tone: "success" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Barra Superior: Selector de Período y Control Temporal ── */}
      <div className="flex justify-end gap-2">
        <AdvancedFilterToggle
          open={filtersOpen}
          onToggle={() => setFiltersOpen((open) => !open)}
        />
        {/* Botón directo a Añadir Compra */}
          <Link href="/purchases/list?tab=add">
            <Button
              size="sm"
              className="h-10 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Añadir Compra</span>
            </Button>
          </Link>
      </div>

      {filtersOpen && (
        <AdvancedFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por RUC, razón social o comprobante..."
          activeFilterCount={Number(statusFilter !== "all") + Number(periodFilter !== "this_month")}
          hasActiveFilters={search.trim() !== "" || statusFilter !== "all" || periodFilter !== "this_month"}
          onClear={() => {
            setSearch("");
            setStatusFilter("all");
            setPeriodFilter("all");
            setCustomStart("");
            setCustomEnd("");
          }}
          resultCount={filtered.length}
          itemLabel="comprobantes"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Período
            </span>
            <SegmentedTabs
              items={PERIOD_TABS}
              value={periodFilter}
              onValueChange={setPeriodFilter}
              size="sm"
              rounded="lg"
              enableCount={false}
              ariaLabel="Período de análisis"
            />
          </div>
          {periodFilter === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Desde
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 w-36 bg-background text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Hasta
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 w-36 bg-background text-xs"
                />
              </label>
              {(customStart || customEnd) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="h-9 text-xs"
                >
                  Resetear rango
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Estado de pago
            </span>
            <SegmentedTabs
              items={statusTabs}
              value={statusFilter}
              onValueChange={setStatusFilter}
              hideZeroCount
              ariaLabel="Estado de pago"
            />
          </div>
        </AdvancedFilterBar>
      )}

      {/* ── Tabla de compras (DataTable compartido) ── */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(inv) => inv.id}
        defaultSort={{ key: "date", direction: "desc" }}
        pageResetKey={`${search}|${statusFilter}|${periodFilter}|${customStart}|${customEnd}`}
        pagination={{ defaultPageSize: 15, itemLabel: "comprobantes" }}
        emptyState={{
          icon: <Receipt className="h-7 w-7" />,
          title: hasActiveFilter
            ? `No se encontraron compras en el período (${periodLabel}) con esos filtros`
            : "Aún no tienes compras registradas en este período",
          description: hasActiveFilter
            ? "Prueba cambiando el período de análisis, los términos de búsqueda o selecciona otro filtro de estado."
            : "Registra tu primera compra unificada con sus insumos y comprobante fiscal.",
          action: hasActiveFilter ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPeriodFilter("all");
              }}
              className="mt-2 rounded-xl text-xs"
            >
              Mostrar Todo el Histórico
            </Button>
          ) : (
            <Link href="/purchases/list?tab=add">
              <Button size="sm" className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-600 text-xs text-white hover:bg-emerald-700">
                <Plus className="h-3.5 w-3.5" /> Registrar Primera Compra
              </Button>
            </Link>
          ),
        }}
      />

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
