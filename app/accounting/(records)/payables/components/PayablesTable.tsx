"use client";

import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  CreditCard,
  Eye,
  AlertCircle,
  BookOpen,
  Building2,
} from "lucide-react";
import type { PayableInvoice } from "@/lib/services/accounting-payables.service";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { PayablePaymentDialog } from "./PayablePaymentDialog";
import { PayableDetailDialog } from "./PayableDetailDialog";
import { filterPayables, type PayableStatusFilter, type PayablesFilters } from "./payables-filters";

interface PayablesTableProps {
  invoices: PayableInvoice[];
  paymentTypes: { id: number; name: string }[];
  onRefresh: () => void;
  filters: PayablesFilters;
  onFiltersChange: (filters: PayablesFilters) => void;
}

export function PayablesTable({ invoices, paymentTypes, onRefresh, filters, onFiltersChange }: PayablesTableProps) {
  const { search, status: statusFilter, onlyOverdue, sortOrder } = filters;
  const setStatusFilter = (status: PayableStatusFilter) => onFiltersChange({ ...filters, status });
  const setOnlyOverdue = (value: boolean) => onFiltersChange({ ...filters, onlyOverdue: value });
  const setSortOrder = (value: "desc" | "asc") => onFiltersChange({ ...filters, sortOrder: value });
  const filtered = useMemo(() => filterPayables(invoices, filters), [invoices, filters]);

  // Modals state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PayableInvoice | null>(null);

  const handleOpenPayment = (inv: PayableInvoice) => {
    setSelectedInvoice(inv);
    setPaymentDialogOpen(true);
  };

  const handleOpenDetail = (inv: PayableInvoice) => {
    setSelectedInvoice(inv);
    setDetailDialogOpen(true);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const columns: DataTableColumn<PayableInvoice>[] = [
    {
      key: "issued",
      header: "Emisión / Antigüedad",
      sortable: true,
      sortValue: (inv) => new Date(inv.issuedAt).getTime(),
      cell: (inv) => (
        <div>
          <div className="font-medium text-foreground">{formatDate(inv.issuedAt)}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>{inv.daysOpen} d.</span>
            {inv.isOverdue && <span className="font-semibold text-rose-600">• Vencido</span>}
          </div>
        </div>
      ),
    },
    {
      key: "voucher",
      header: "Comprobante",
      cell: (inv) => (
        <div>
          <div className="font-mono font-semibold text-foreground">{inv.voucherLabel}</div>
          <div className="text-[10px] uppercase text-muted-foreground">{inv.voucherType}</div>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      width: "max-w-[220px]",
      primary: {
        title: (inv) => inv.supplier.businessName,
        subtitle: (inv) => `RUC: ${inv.supplier.ruc}`,
        icon: <Building2 />,
      },
    },
    {
      key: "account",
      header: "Cta. Contable",
      cell: () => (
        <Tag tone="neutral" size="sm">
          4212 Pasivo
        </Tag>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cellClassName: "font-mono font-medium text-foreground",
      cell: (inv) => `S/ ${inv.totalAmount.toFixed(2)}`,
    },
    {
      key: "paid",
      header: "Amortizado",
      align: "right",
      cellClassName: "font-mono font-medium text-emerald-600 dark:text-emerald-400",
      cell: (inv) => `S/ ${inv.totalPaid.toFixed(2)}`,
    },
    {
      key: "pending",
      header: "Saldo Pendiente",
      align: "right",
      cellClassName: "font-mono font-bold",
      cell: (inv) => (
        <span
          className={
            inv.pendingBalance > 0
              ? "rounded border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
              : "text-muted-foreground"
          }
        >
          S/ {inv.pendingBalance.toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      cell: (inv) => (
        <StatusBadge tone={inv.status === "Pagado" ? "success" : inv.status === "Parcial" ? "info" : "warning"} size="sm">
          {inv.status === "Pagado" ? "Cancelado" : inv.status}
        </StatusBadge>
      ),
    },
    {
      key: "entries",
      header: "Asientos",
      align: "center",
      cell: (inv) => (
        <button
          type="button"
          onClick={() => handleOpenDetail(inv)}
          className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] font-medium text-primary hover:underline"
          title="Ver asientos contables vinculados"
        >
          <BookOpen className="h-3 w-3" />
          <span>
            {inv.journalEntries.length} asiento{inv.journalEntries.length !== 1 ? "s" : ""}
          </span>
        </button>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (inv) => (
        <RowActions
          size="sm"
          actions={[
            {
              key: "pay",
              label: "Pagar",
              icon: <CreditCard />,
              tone: "emerald",
              mode: "both",
              hidden: inv.pendingBalance <= 0,
              onClick: () => handleOpenPayment(inv),
            },
            { key: "detail", label: "Ver detalle del comprobante y asientos", icon: <Eye />, tone: "neutral", onClick: () => handleOpenDetail(inv) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Card className="p-5 bg-white dark:bg-card border-border/80 shadow-xs rounded-xl space-y-4">
        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            ariaLabel="Filtrar por estado"
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value)}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "todos", label: "Todos", count: invoices.length, tone: "brand" },
              { value: "Pendiente", label: "Pendientes", count: invoices.filter((i) => i.status === "Pendiente").length, tone: "danger" },
              { value: "Parcial", label: "Amortización Parcial", count: invoices.filter((i) => i.status === "Parcial").length, tone: "info" },
              { value: "Pagado", label: "Cancelados", count: invoices.filter((i) => i.status === "Pagado").length, tone: "success" },
            ]}
          />

          <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => {
              setOnlyOverdue(!onlyOverdue);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
              onlyOverdue
                ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                : "bg-transparent text-muted-foreground border-border/80 hover:bg-surface-container-low"
            }`}
          >
            Solo Vencidos (&gt; 30 días)
          </button>
        </div>

        {/* Main Table (DataTable compartido) */}
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(inv) => inv.id}
          density="compact"
          sort={{ key: "issued", direction: sortOrder }}
          manualSort
          onSortChange={(next) => setSortOrder(next?.direction ?? "desc")}
          pageResetKey={`${search}|${statusFilter}|${onlyOverdue}`}
          pagination={{ defaultPageSize: 12, itemLabel: "comprobantes" }}
          emptyState={{
            icon: <AlertCircle className="h-7 w-7" />,
            title: "No se encontraron cuentas por pagar con los filtros seleccionados.",
          }}
        />
      </Card>

      {/* Payment Modal */}
      <PayablePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        paymentTypes={paymentTypes}
        onSuccess={onRefresh}
      />

      {/* Detail Modal */}
      <PayableDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        invoice={selectedInvoice}
        onOpenPayment={(inv) => handleOpenPayment(inv)}
      />
    </>
  );
}
