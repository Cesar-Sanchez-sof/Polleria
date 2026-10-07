"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Building2,
  FileText,
  Receipt,
  Calendar,
  DollarSign,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import type { PurchaseInvoice } from "./PurchasesTable";

interface PurchaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice;
  onRegisterPayment: (invoice: PurchaseInvoice) => void;
}

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

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

export function PurchaseDetailDialog({
  open,
  onOpenChange,
  invoice,
  onRegisterPayment,
}: PurchaseDetailDialogProps) {
  const subtotal = Number(invoice.subtotal);
  const igv = Number(invoice.igv);
  const totalAmount = Number(invoice.totalAmount);
  const totalPagado = Number(invoice.totalPagado);
  const saldoPendiente = Number(invoice.saldoPendiente);

  const items = invoice.purchaseOrder?.items ?? [];
  const payments = invoice.payments ?? [];

  // Estado de pago badge styling
  const statusBadge = () => {
    switch (invoice.estadoPago) {
      case "Pagado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            Pagado
          </span>
        );
      case "Parcial":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800">
            <Clock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
            Pago Parcial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100/80 text-rose-900 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800">
            <AlertCircle className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden bg-card border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl">

        {/* ── Header fijo ── */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60 shadow-2xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  Detalle de Compra
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Información fiscal, desglose de insumos y registro de pagos
                </p>
              </div>
            </div>
            <div className="mr-6 sm:mr-8">
              {statusBadge()}
            </div>
          </div>

          {/* Cards resumen cabecera: Proveedor y Comprobante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
            {/* Tarjeta Proveedor */}
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-background/80 p-3.5 flex items-start gap-3 shadow-2xs">
              <div className="h-8 w-8 rounded-lg bg-blue-50/80 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100/70">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Proveedor
                </p>
                <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                  {invoice.supplier.businessName}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                  <span>{invoice.supplier.ruc.length === 8 ? "DNI:" : "RUC:"} {invoice.supplier.ruc}</span>
                  {invoice.supplier.phone && <span>• Tel: {invoice.supplier.phone}</span>}
                </div>
              </div>
            </div>

            {/* Tarjeta Comprobante */}
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-background/80 p-3.5 flex items-start gap-3 shadow-2xs">
              <div className="h-8 w-8 rounded-lg bg-amber-50/80 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-100/70">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Comprobante Fiscal
                </p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {invoice.voucherType} {invoice.series}-{invoice.number}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Emisión: {formatDate(invoice.issuedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ── Cuerpo con scroll vertical ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">

          {/* Bloque: Insumos de la Orden */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-background shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  Detalle de Insumos Recibidos
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                {items.length} {items.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No se registraron líneas de insumo en esta compra.
              </div>
            ) : (
              <div className="overflow-x-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 text-muted-foreground">
                      <th className="text-left py-2.5 px-3 font-semibold uppercase tracking-wider text-[10px]">Insumo</th>
                      <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-[10px] w-20">Cant.</th>
                      <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-[10px] w-24">P. Unit.</th>
                      <th className="text-center py-2.5 px-2 font-semibold uppercase tracking-wider text-[10px] w-20">Afectación</th>
                      <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-[10px] w-24">Subtotal</th>
                      <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-[10px] w-20">IGV</th>
                      <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-[10px] w-24">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item) => {
                      const qty = Number(item.quantityReceived ?? item.quantityOrdered);
                      const price = Number(item.unitPrice);
                      const isIgvIncluded = item.affectationIgv === "Included";
                      const lineSubtotal = qty * price;
                      const lineIgv = isIgvIncluded
                        ? Math.round(lineSubtotal * (18 / 118) * 100) / 100
                        : Math.round(lineSubtotal * 0.18 * 100) / 100;
                      const lineMonto = isIgvIncluded ? lineSubtotal : lineSubtotal + lineIgv;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-foreground block truncate">
                              {item.supply.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.supply.unitOfMeasure}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium">
                            {qty.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            S/ {price.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                isIgvIncluded
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {isIgvIncluded ? "Incluido" : "Excluido"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            S/ {lineSubtotal.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            S/ {lineIgv.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            S/ {lineMonto.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bloque: Pagos Registrados y Resumen Financiero en 2 Columnas */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

            {/* Columna Izquierda: Historial de Pagos */}
            <div className="md:col-span-6 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-background shadow-2xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-foreground">
                      Historial de Pagos y Abonos
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    {payments.length}
                  </span>
                </div>

                {payments.length === 0 ? (
                  <div className="py-8 text-center px-4 space-y-1">
                    <Clock className="h-6 w-6 text-muted-foreground/50 mx-auto" />
                    <p className="text-xs font-medium text-muted-foreground">
                      Sin pagos registrados
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Esta compra está pendiente de pago.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">
                            {p.paymentType.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDateTime(p.paidAt)}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-2 py-1 rounded-md">
                          S/ {Number(p.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Resumen Financiero */}
            <div className="md:col-span-6 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-foreground">
                <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Resumen de Liquidación</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal Insumos:</span>
                  <span className="font-mono font-medium text-foreground">
                    S/ {subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>IGV Total (18%):</span>
                  <span className="font-mono font-medium text-foreground">
                    S/ {igv.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-800 pt-2 text-sm font-bold text-foreground">
                  <span>Monto Total:</span>
                  <span className="font-mono text-base">
                    S/ {totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400">
                  <span className="font-medium">Total Pagado:</span>
                  <span className="font-mono font-semibold">
                    S/ {totalPagado.toFixed(2)}
                  </span>
                </div>
                <div
                  className={`flex justify-between items-center border-t border-slate-200/60 dark:border-slate-800 pt-2 ${
                    saldoPendiente > 0.005
                      ? "text-rose-700 dark:text-rose-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  <span className="font-bold text-xs uppercase tracking-wider">Saldo Pendiente:</span>
                  <span className="font-mono text-lg font-black">
                    S/ {saldoPendiente.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer fijo ── */}
        <DialogFooter className="shrink-0 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cerrar
          </Button>

          {saldoPendiente > 0.005 && (
            <Button
              type="button"
              size="sm"
              onClick={() => onRegisterPayment(invoice)}
              className="h-9 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-all"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Registrar Pago
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
