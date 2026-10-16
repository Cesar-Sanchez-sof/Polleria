"use client";

import React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Building2,
  Calendar,
  CreditCard,
  BookOpen,
  Package,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { PayableInvoice } from "@/lib/services/accounting-payables.service";

interface PayableDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PayableInvoice | null;
  onOpenPayment?: (invoice: PayableInvoice) => void;
}

export function PayableDetailDialog({
  open,
  onOpenChange,
  invoice,
  onOpenPayment,
}: PayableDetailDialogProps) {
  if (!invoice) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {invoice.voucherLabel}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Detalle contable y estado de cuenta corriente comercial
                </p>
              </div>
            </div>

            {invoice.pendingBalance > 0 && onOpenPayment && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  onOpenChange(false);
                  onOpenPayment(invoice);
                }}
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Amortizar Saldo
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 text-sm">
          {/* Header Data Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Proveedor */}
            <div className="p-3 bg-surface-container-low rounded-xl border border-border/60">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>Proveedor</span>
              </div>
              <p className="font-semibold text-foreground text-sm truncate">
                {invoice.supplier.businessName}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                RUC: {invoice.supplier.ruc}
              </p>
              {invoice.supplier.phone && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tel: {invoice.supplier.phone}
                </p>
              )}
            </div>

            {/* Fechas y Plazos */}
            <div className="p-3 bg-surface-container-low rounded-xl border border-border/60">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Emisión y Antigüedad</span>
              </div>
              <p className="font-semibold text-foreground text-sm">
                {formatDate(invoice.issuedAt)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Antigüedad: {invoice.daysOpen} días
              </p>
              <div className="mt-1">
                {invoice.isOverdue ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                    <Clock className="w-3 h-3" /> Vencido (&gt; 30 días)
                  </span>
                ) : invoice.pendingBalance <= 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Cancelado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <Clock className="w-3 h-3" /> Dentro del plazo corriente
                  </span>
                )}
              </div>
            </div>

            {/* Importes Financieros */}
            <div className="p-3 bg-surface-container-low rounded-xl border border-border/60">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>Saldos Contables</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold text-foreground">S/ {invoice.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400">
                <span>Amortizado:</span>
                <span className="font-semibold">S/ {invoice.totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border/60 mt-1">
                <span className="text-amber-800 dark:text-amber-400">Saldo Pendiente:</span>
                <span className="text-amber-700 dark:text-amber-300 text-sm">
                  S/ {invoice.pendingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Insumos Comprados */}
          {invoice.orderItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Package className="w-4 h-4 text-primary" />
                <span>Insumos / Detalle de la Orden de Compra</span>
              </div>
              <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Insumo</th>
                      <th className="py-2 px-3 font-semibold text-center">Unidad</th>
                      <th className="py-2 px-3 font-semibold text-right">Cantidad</th>
                      <th className="py-2 px-3 font-semibold text-right">Precio Unit.</th>
                      <th className="py-2 px-3 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {invoice.orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium text-foreground">{item.supplyName}</td>
                        <td className="py-2 px-3 text-center text-muted-foreground">{item.unitOfMeasure}</td>
                        <td className="py-2 px-3 text-right font-mono">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">S/ {item.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-semibold font-mono text-foreground">
                          S/ {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Historial de Pagos y Amortizaciones */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Historial de Pagos y Amortizaciones (Egresos Caja/Bancos)</span>
            </div>
            {invoice.payments.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                Aún no se han registrado amortizaciones para este comprobante.
              </div>
            ) : (
              <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Fecha de Pago</th>
                      <th className="py-2 px-3 font-semibold">Medio de Pago</th>
                      <th className="py-2 px-3 font-semibold text-right">Monto Amortizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {invoice.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 font-mono">{formatDate(p.paidAt)}</td>
                        <td className="py-2 px-3 font-medium text-foreground">{p.paymentType.name}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          S/ {p.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Asientos Contables Vinculados (Libro Diario) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Asientos Contables en Libro Diario ({invoice.journalEntries.length})</span>
              </div>
              <Link
                href="/accounting/entries"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <span>Ver Libro Diario Completo</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {invoice.journalEntries.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                No hay asientos registrados directamente vinculados.
              </div>
            ) : (
              <div className="space-y-2.5">
                {invoice.journalEntries.map((je) => (
                  <div
                    key={je.id}
                    className="p-3 bg-surface-container-low rounded-xl border border-border/60 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary font-mono">{je.code}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium text-foreground">{je.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-muted font-medium">
                          {je.book}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          {formatDate(je.entryDate)}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="py-1">Cuenta</th>
                            <th className="py-1">Glosa</th>
                            <th className="py-1 text-right">Debe</th>
                            <th className="py-1 text-right">Haber</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {je.entryDetails.map((detail) => (
                            <tr key={detail.id}>
                              <td className="py-1 font-mono font-medium text-foreground">
                                {detail.account.code} - {detail.account.name}
                              </td>
                              <td className="py-1 text-muted-foreground truncate max-w-[200px]">
                                {detail.description || "—"}
                              </td>
                              <td className="py-1 text-right font-mono font-semibold text-foreground">
                                {detail.debit > 0 ? `S/ ${detail.debit.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-1 text-right font-mono font-semibold text-foreground">
                                {detail.credit > 0 ? `S/ ${detail.credit.toFixed(2)}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
