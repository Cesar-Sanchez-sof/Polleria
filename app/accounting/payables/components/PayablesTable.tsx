"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import {
  Search,
  Filter,
  Download,
  CreditCard,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  BookOpen,
  ArrowUpDown,
  Building2,
  Calendar,
  X,
  FileSpreadsheet,
} from "lucide-react";
import type { PayableInvoice } from "@/lib/services/accounting-payables.service";
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
  const [page, setPage] = useState(1);
  const pageSize = 12;

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
                setPage(1);
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
              setPage(1);
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
              setPage(1);
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
              setPage(1);
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
              setPage(1);
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
              setPage(1);
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

        {/* Main Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60 border-b border-border/80 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Emisión / Antigüedad</th>
                <th className="py-2.5 px-3 font-semibold">Comprobante</th>
                <th className="py-2.5 px-3 font-semibold">Proveedor</th>
                <th className="py-2.5 px-3 font-semibold">Cta. Contable</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amortizado</th>
                <th className="py-2.5 px-3 font-semibold text-right">Saldo Pendiente</th>
                <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                <th className="py-2.5 px-3 font-semibold text-center">Asientos</th>
                <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="font-medium">No se encontraron cuentas por pagar con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    {/* Fecha de Emisión */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-foreground">{formatDate(inv.issuedAt)}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>{inv.daysOpen} d.</span>
                        {inv.isOverdue && (
                          <span className="text-rose-600 font-semibold">• Vencido</span>
                        )}
                      </div>
                    </td>

                    {/* Comprobante */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground font-mono">{inv.voucherLabel}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{inv.voucherType}</div>
                    </td>

                    {/* Proveedor */}
                    <td className="py-3 px-3 max-w-[200px]">
                      <div className="font-medium text-foreground truncate" title={inv.supplier.businessName}>
                        {inv.supplier.businessName}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        RUC: {inv.supplier.ruc}
                      </div>
                    </td>

                    {/* Cuenta Contable */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-muted font-mono font-medium text-muted-foreground">
                        4212 Pasivo
                      </span>
                    </td>

                    {/* Total */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-foreground">
                      S/ {inv.totalAmount.toFixed(2)}
                    </td>

                    {/* Amortizado */}
                    <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      S/ {inv.totalPaid.toFixed(2)}
                    </td>

                    {/* Saldo Pendiente */}
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span
                        className={
                          inv.pendingBalance > 0
                            ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/40"
                            : "text-muted-foreground"
                        }
                      >
                        S/ {inv.pendingBalance.toFixed(2)}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="py-3 px-3 text-center">
                      {inv.status === "Pagado" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Cancelado
                        </span>
                      ) : inv.status === "Parcial" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Clock className="w-3 h-3" /> Parcial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </td>

                    {/* Asientos */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(inv)}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-mono font-medium cursor-pointer"
                        title="Ver asientos contables vinculados"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{inv.journalEntries.length} asiento{inv.journalEntries.length !== 1 ? "s" : ""}</span>
                      </button>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.pendingBalance > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayment(inv)}
                            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            title="Registrar amortización o pago"
                          >
                            <CreditCard className="w-3 h-3 mr-1" />
                            Pagar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(inv)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Ver detalle del comprobante y asientos"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <div>
              Mostrando {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} comprobantes
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs"
              >
                Anterior
              </Button>
              <span className="font-medium px-2">
                Pág. {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 text-xs"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
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
