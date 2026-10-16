"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import {
  Search,
  Download,
  CreditCard,
  Eye,
  AlertCircle,
  BookOpen,
  ArrowUpDown,
  Building2,
  X,
} from "lucide-react";
import type { PayableInvoice } from "@/lib/services/accounting-payables.service";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { PayablePaymentDialog } from "./PayablePaymentDialog";
import { PayableDetailDialog } from "./PayableDetailDialog";

interface PayablesTableProps {
  invoices: PayableInvoice[];
  paymentTypes: { id: number; name: string }[];
  onRefresh: () => void;
}

export function PayablesTable({ invoices, paymentTypes, onRefresh }: PayablesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "Pendiente" | "Parcial" | "Pagado">("todos");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Modals state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PayableInvoice | null>(null);

  // Filtered & sorted
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return invoices
      .filter((inv) => {
        if (statusFilter !== "todos" && inv.status !== statusFilter) return false;
        if (onlyOverdue && !inv.isOverdue) return false;

        if (q) {
          const matchVoucher = inv.voucherLabel.toLowerCase().includes(q);
          const matchSupplier = inv.supplier.businessName.toLowerCase().includes(q);
          const matchRuc = inv.supplier.ruc.toLowerCase().includes(q);
          return matchVoucher || matchSupplier || matchRuc;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.issuedAt).getTime();
        const timeB = new Date(b.issuedAt).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [invoices, search, statusFilter, onlyOverdue, sortOrder]);


  const handleOpenPayment = (inv: PayableInvoice) => {
    setSelectedInvoice(inv);
    setPaymentDialogOpen(true);
  };

  const handleOpenDetail = (inv: PayableInvoice) => {
    setSelectedInvoice(inv);
    setDetailDialogOpen(true);
  };

  const exportToCsv = () => {
    const headers = [
      "Fecha Emisión",
      "Tipo Comprobante",
      "Serie",
      "Número",
      "RUC Proveedor",
      "Razón Social Proveedor",
      "Cuenta Contable",
      "Total Comprobante",
      "Monto Amortizado",
      "Saldo Pendiente",
      "Estado de Pago",
      "Días Antigüedad",
      "Vencido (>30d)",
      "Asientos Contables",
    ];

    const rows = filtered.map((inv) => [
      inv.issuedAt.split("T")[0],
      inv.voucherType,
      inv.series,
      inv.number,
      `"${inv.supplier.ruc}"`,
      `"${inv.supplier.businessName.replace(/"/g, '""')}"`,
      "4212 Cuentas por Pagar Comerciales",
      inv.totalAmount.toFixed(2),
      inv.totalPaid.toFixed(2),
      inv.pendingBalance.toFixed(2),
      inv.status,
      inv.daysOpen,
      inv.isOverdue ? "SÍ" : "NO",
      `"${inv.journalEntries.map((je) => je.code).join(", ")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cuentas_por_pagar_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por proveedor, RUC o N° comprobante..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              className="pl-9 pr-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="text-xs h-9"
              title="Cambiar orden por fecha de emisión"
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <span>{sortOrder === "desc" ? "Más recientes" : "Más antiguos"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              className="text-xs h-9 border-border/80"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <span>Exportar CSV</span>
            </Button>

            <Link
              href="/accounting/entries"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "text-xs h-9 border-border/80"
              )}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1 text-primary" />
              <span>Libro Diario</span>
            </Link>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Filtro Estado:</span>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("todos");
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === "todos"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-surface-container-low text-muted-foreground hover:bg-surface-container"
            }`}
          >
            Todos ({invoices.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("Pendiente");
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === "Pendiente"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-surface-container-low text-muted-foreground hover:bg-surface-container"
            }`}
          >
            Pendientes ({invoices.filter((i) => i.status === "Pendiente").length})
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("Parcial");
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === "Parcial"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-surface-container-low text-muted-foreground hover:bg-surface-container"
            }`}
          >
            Amortización Parcial ({invoices.filter((i) => i.status === "Parcial").length})
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("Pagado");
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === "Pagado"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-surface-container-low text-muted-foreground hover:bg-surface-container"
            }`}
          >
            Cancelados ({invoices.filter((i) => i.status === "Pagado").length})
          </button>

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
