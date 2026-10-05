"use client";

import React, { useState } from "react";
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
import { createPurchaseVoucher } from "@/lib/services/purchases/invoices";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { FileCheck } from "lucide-react";

interface ReceiptWithoutVoucher {
  id: number;
  receivedAt: Date | string;
  purchaseOrder: {
    orderNumber: string;
    supplier: {
      id: number;
      businessName: string;
      ruc: string;
    };
  };
  items: Array<{
    quantityReceived: number | string;
    purchaseOrderItem: {
      unitPrice: number | string;
      supply: {
        name: string;
        unitOfMeasure: string;
      };
    };
  }>;
}

interface PaymentType {
  id: number;
  name: string;
}

interface NewVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptsWithoutVoucher: ReceiptWithoutVoucher[];
  paymentTypes: PaymentType[];
  onSuccess: () => void;
}

export function NewVoucherDialog({
  open,
  onOpenChange,
  receiptsWithoutVoucher,
  paymentTypes,
  onSuccess,
}: NewVoucherDialogProps) {
  const [loading, setLoading] = useState(false);
  const [receiptId, setReceiptId] = useState<number | "">("");
  const [voucherType, setVoucherType] = useState<string>("Factura");
  const [series, setSeries] = useState("");
  const [numberValue, setNumberValue] = useState<number | "">("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentCondition, setPaymentCondition] = useState<"Contado" | "Credito">("Contado");
  const [paymentTypeId, setPaymentTypeId] = useState<number | "">(
    paymentTypes.length > 0 ? paymentTypes[0].id : ""
  );

  const selectedReceipt = receiptsWithoutVoucher.find(
    (r) => r.id === Number(receiptId)
  );

  let subtotal = 0;
  if (selectedReceipt) {
    selectedReceipt.items.forEach((d) => {
      const qty = Number(d.quantityReceived);
      const price = Number(d.purchaseOrderItem.unitPrice);
      subtotal += qty * price;
    });
  }
  const igv = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + igv;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptId || !selectedReceipt) {
      toast.error("Debe seleccionar una recepción de compra");
      return;
    }
    if (!series.trim() || !numberValue) {
      toast.error("Debe ingresar la serie y número del comprobante");
      return;
    }
    if (paymentCondition === "Contado" && !paymentTypeId) {
      toast.error("Debe seleccionar el tipo de pago para venta al contado");
      return;
    }

    setLoading(true);
    try {
      await createPurchaseVoucher({
        supplierId: selectedReceipt.purchaseOrder.supplier.id,
        receiptId: Number(receiptId),
        voucherType,
        series: series.toUpperCase().trim(),
        number: Number(numberValue),
        issuedAt: issueDate,
        paymentCondition,
        paymentTypeId: paymentCondition === "Contado" ? Number(paymentTypeId) : undefined,
      });

      toast.success(`${voucherType} registrada exitosamente`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el comprobante");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" /> Registrar Comprobante de Compra
          </DialogTitle>
          <DialogDescription>
            Selecciona una recepción confirmada para generar el comprobante (Factura/Boleta) correspondiente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="receipt">Recepción de Compra Confirmada *</Label>
            <Select
              value={receiptId ? receiptId.toString() : ""}
              onValueChange={(val) => setReceiptId(Number(val))}
            >
              <SelectTrigger id="receipt">
                <SelectValue placeholder="Seleccionar Recepción">
                  {selectedReceipt
                    ? `Recepción #${selectedReceipt.id} - ${selectedReceipt.purchaseOrder.supplier.businessName} (Ord #${selectedReceipt.purchaseOrder.orderNumber})`
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {receiptsWithoutVoucher.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay recepciones pendientes de factura
                  </SelectItem>
                ) : (
                  receiptsWithoutVoucher.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      Recepción #{r.id} - {r.purchaseOrder.supplier.businessName} (Ord #{r.purchaseOrder.orderNumber})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedReceipt && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
              <div className="font-semibold text-sm border-b pb-1 text-foreground">
                Insumos Recepcionados ({selectedReceipt.purchaseOrder.supplier.businessName}):
              </div>
              <div className="space-y-1">
                {selectedReceipt.items.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {d.purchaseOrderItem.supply.name} (
                      {Number(d.quantityReceived)} {d.purchaseOrderItem.supply.unitOfMeasure})
                    </span>
                    <span className="font-mono">
                      S/{" "}
                      {(
                        Number(d.quantityReceived) *
                        Number(d.purchaseOrderItem.unitPrice)
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="voucherType">Tipo Comprobante</Label>
              <Select value={voucherType} onValueChange={(val) => setVoucherType(val ?? "Factura")}>
                <SelectTrigger id="voucherType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Factura">Factura</SelectItem>
                  <SelectItem value="Boleta">Boleta</SelectItem>
                  <SelectItem value="Guía de Remisión">Guía de Remisión</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="series">Serie *</Label>
              <Input
                id="series"
                placeholder="F001"
                maxLength={4}
                value={series}
                onChange={(e) => setSeries(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="number">Número *</Label>
              <Input
                id="number"
                type="number"
                placeholder="12345"
                value={numberValue}
                onChange={(e) => setNumberValue(parseInt(e.target.value) || "")}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="issuedAt">Fecha de Emisión *</Label>
              <Input
                id="issuedAt"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentCondition">Condición de Pago</Label>
              <Select
                value={paymentCondition}
                onValueChange={(val) => setPaymentCondition(val as "Contado" | "Credito")}
              >
                <SelectTrigger id="paymentCondition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contado">Contado (Pagado ya)</SelectItem>
                  <SelectItem value="Credito">Crédito (Pago pendiente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentCondition === "Contado" && (
            <div className="space-y-1.5">
              <Label htmlFor="paymentType">Medio de Pago *</Label>
              <Select
                value={paymentTypeId ? paymentTypeId.toString() : ""}
                onValueChange={(val) => setPaymentTypeId(Number(val))}
              >
                <SelectTrigger id="paymentType">
                  <SelectValue placeholder="Seleccionar medio de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id.toString()}>
                      {tp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-lg border bg-card p-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span>S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IGV (18%):</span>
              <span>S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>Monto Total Comprobante:</span>
              <span className="text-primary">S/ {total.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !selectedReceipt}>
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              Guardar Comprobante
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
