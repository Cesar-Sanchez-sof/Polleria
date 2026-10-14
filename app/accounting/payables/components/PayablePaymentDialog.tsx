"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Loader2, AlertCircle, ArrowDownCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { payPayableInvoiceAction, type PayableInvoice } from "@/lib/services/accounting-payables.service";

interface PayablePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PayableInvoice | null;
  paymentTypes: { id: number; name: string }[];
  onSuccess: () => void;
}

export function PayablePaymentDialog({
  open,
  onOpenChange,
  invoice,
  paymentTypes,
  onSuccess,
}: PayablePaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [paymentTypeId, setPaymentTypeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  React.useEffect(() => {
    if (invoice) {
      setAmount(invoice.pendingBalance.toFixed(2));
      if (paymentTypes.length > 0 && !paymentTypeId) {
        setPaymentTypeId(String(paymentTypes[0].id));
      }
    }
  }, [invoice, paymentTypes, paymentTypeId]);

  if (!invoice) return null;

  const numAmount = parseFloat(amount) || 0;
  const isInvalidAmount = numAmount <= 0 || numAmount > invoice.pendingBalance + 0.009;

  const handlePay = () => {
    if (isInvalidAmount) {
      toast.error("El monto ingresado no es válido o supera el saldo pendiente.");
      return;
    }
    if (!paymentTypeId) {
      toast.error("Seleccione un método de pago.");
      return;
    }

    startTransition(async () => {
      try {
        await payPayableInvoiceAction(invoice.id, Number(paymentTypeId), numAmount);
        toast.success(`Pago de S/ ${numAmount.toFixed(2)} registrado correctamente. Asiento contable generado.`);
        onOpenChange(false);
        onSuccess();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al registrar el pago.");
      }
    });
  };

  const handleSetFull = () => {
    setAmount(invoice.pendingBalance.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <DialogTitle>Amortizar / Cancelar Cuenta por Pagar</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Registra la salida de fondos y cancela el pasivo en la Cuenta 42 (PCGE).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Resumen del comprobante */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-border/60 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Comprobante:</span>
              <span className="font-semibold text-foreground">{invoice.voucherLabel}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Proveedor:</span>
              <span className="font-medium text-foreground text-right truncate max-w-[220px]">
                {invoice.supplier.businessName}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Total Comprobante:</span>
              <span className="font-medium text-foreground">S/ {invoice.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Total Ya Pagado:</span>
              <span className="font-medium text-emerald-700">S/ {invoice.totalPaid.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-border/60 flex justify-between items-center">
              <span className="font-bold text-xs text-amber-900 dark:text-amber-300">
                Saldo Pendiente Actual:
              </span>
              <span className="font-bold text-base text-amber-700 dark:text-amber-400">
                S/ {invoice.pendingBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Selector de Método de Pago */}
          <div className="space-y-1.5">
            <Label htmlFor="paymentType" className="text-xs font-semibold">
              Medio de Pago / Cuenta de Salida (Cta. 10)
            </Label>
            <Select
              value={paymentTypeId}
              onValueChange={(value) => setPaymentTypeId(value ?? "")}
            >
              <SelectTrigger id="paymentType" className="w-full">
                <SelectValue placeholder="Seleccione medio de pago" />
              </SelectTrigger>
              <SelectContent>
                {paymentTypes.map((pt) => (
                  <SelectItem key={pt.id} value={String(pt.id)}>
                    {pt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input de Monto */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="amount" className="text-xs font-semibold">
                Monto a Pagar (S/)
              </Label>
              <button
                type="button"
                onClick={handleSetFull}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                Pagar Saldo Total (S/ {invoice.pendingBalance.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">
                S/
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.pendingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9 font-semibold text-base"
                placeholder="0.00"
              />
            </div>
            {isInvalidAmount && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Monto debe ser mayor a 0 y no superar S/ {invoice.pendingBalance.toFixed(2)}.
              </p>
            )}
          </div>

          {/* Explicación de impacto contable */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <ArrowDownCircle className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold">Asiento Contable Automático:</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                • DEBE: 4212 Cuentas por pagar comerciales (Disminuye pasivo)
                <br />• HABER: 101/104 Caja o Bancos (Disminuye activo)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handlePay}
            disabled={isPending || isInvalidAmount || !paymentTypeId}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando Asiento...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar Pago
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
