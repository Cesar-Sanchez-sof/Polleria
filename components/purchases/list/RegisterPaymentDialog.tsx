"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { registerPurchasePayment } from "@/lib/services/purchases/invoices";
import type { PurchaseInvoice, PaymentType } from "./PurchasesTable";

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice;
  paymentTypes: PaymentType[];
}

function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  invoice,
  paymentTypes,
}: RegisterPaymentDialogProps) {
  const router = useRouter();

  const saldo = Number(invoice.saldoPendiente);

  const [paymentTypeId, setPaymentTypeId] = useState<string>("");
  const [amount, setAmount] = useState<string>(saldo.toFixed(2));
  const [date, setDate] = useState<string>(todayString());
  const [loading, setLoading] = useState(false);

  const selectedPaymentType = paymentTypes.find((pt) => String(pt.id) === String(paymentTypeId));

  // Reset when dialog opens
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setPaymentTypeId("");
      setAmount(saldo.toFixed(2));
      setDate(todayString());
    }
    onOpenChange(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);

    if (!paymentTypeId) {
      toast.error("Selecciona un tipo de pago");
      return;
    }
    if (!numAmount || numAmount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (numAmount > saldo + 0.01) {
      toast.error(`El monto supera el saldo pendiente (S/ ${saldo.toFixed(2)})`);
      return;
    }

    setLoading(true);
    try {
      await registerPurchasePayment(invoice.id, Number(paymentTypeId), numAmount);
      toast.success("Pago registrado exitosamente");
      onOpenChange(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Registrar Pago
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">

          {/* Info Card */}
          <div className="rounded-lg border-2 bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comprobante:</span>
              <span className="font-mono font-semibold">
                {invoice.voucherType} {invoice.series}-{invoice.number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Proveedor:</span>
              <span className="font-medium">{invoice.supplier.businessName}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground font-semibold">Saldo pendiente:</span>
              <span className="font-mono font-bold text-rose-700 text-base">
                S/ {saldo.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Tipo de pago */}
          <div className="space-y-1.5">
            <Label htmlFor="paymentType" className="text-sm font-medium">
              Tipo de Pago <span className="text-rose-500">*</span>
            </Label>
            <Select value={paymentTypeId} onValueChange={(val) => setPaymentTypeId(val ?? "")}>
              <SelectTrigger id="paymentType" className="h-9">
                <SelectValue placeholder="Seleccionar tipo de pago">
                  {selectedPaymentType ? selectedPaymentType.name : undefined}
                </SelectValue>
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

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-sm font-medium">
              Monto (S/) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={saldo + 0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 font-mono"
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Máximo permitido: S/ {saldo.toFixed(2)}
            </p>
          </div>

          {/* Fecha (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="paymentDate" className="text-sm font-medium">
              Fecha de Pago
            </Label>
            <Input
              id="paymentDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Registrar Pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
