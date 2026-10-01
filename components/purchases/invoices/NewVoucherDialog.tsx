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
import { createPurchaseVoucher, PurchaseVoucherInput } from "@/lib/services/purchases/invoices";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { FileCheck } from "lucide-react";

interface RecepcionSinComprobante {
  id_recepcion: number;
  fecha_recepcion: Date | string;
  orden_compra: {
    numero_orden: string;
    proveedor: {
      id_proveedor: number;
      razon_social: string;
      ruc: string;
    };
  };
  detalles_recepcion_compra: Array<{
    cantidad_recibida: number | string;
    detalle_orden_compra: {
      precio_unitario: number | string;
      insumo: {
        nombre: string;
        unidad_medida: string;
      };
    };
  }>;
}

interface PaymentType {
  id_tipo_pago: number;
  nombre: string;
}

interface NewVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptsWithoutVoucher: RecepcionSinComprobante[];
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
  const [paymentTerms, setPaymentTerms] = useState<"Contado" | "Credito">("Contado");
  const [paymentTypeId, setPaymentTypeId] = useState<number | "">(
    paymentTypes.length > 0 ? paymentTypes[0].id_tipo_pago : ""
  );

  const selectedReceipt = receiptsWithoutVoucher.find(
    (r) => r.id_recepcion === Number(receiptId)
  );

  // Calculations for chosen reception
  let subtotal = 0;
  if (selectedReceipt) {
    selectedReceipt.detalles_recepcion_compra.forEach((d) => {
      const cant = Number(d.cantidad_recibida);
      const prec = Number(d.detalle_orden_compra.precio_unitario);
      subtotal += cant * prec;
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
    if (paymentTerms === "Contado" && !paymentTypeId) {
      toast.error("Debe seleccionar el tipo de pago para venta al contado");
      return;
    }

    setLoading(true);
    try {
      await createPurchaseVoucher({
        id_proveedor: selectedReceipt.orden_compra.proveedor.id_proveedor,
        id_recepcion: Number(receiptId),
        tipo_comprobante: voucherType,
        serie: series.toUpperCase().trim(),
        numero: Number(numberValue),
        fecha_emision: issueDate,
        condicion_pago: paymentTerms,
        id_tipo_pago: paymentTerms === "Contado" ? Number(paymentTypeId) : undefined,
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
            <Label htmlFor="recepcion">Recepción de Compra Confirmada *</Label>
            <Select
              value={receiptId ? receiptId.toString() : ""}
              onValueChange={(val) => setReceiptId(Number(val))}
            >
              <SelectTrigger id="recepcion">
                <SelectValue placeholder="Seleccionar Recepción">
                  {selectedReceipt
                    ? `Recepción #${selectedReceipt.id_recepcion} - ${selectedReceipt.orden_compra.proveedor.razon_social} (Ord #${selectedReceipt.orden_compra.numero_orden})`
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
                    <SelectItem key={r.id_recepcion} value={r.id_recepcion.toString()}>
                      Recepción #{r.id_recepcion} - {r.orden_compra.proveedor.razon_social} (Ord #{r.orden_compra.numero_orden})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedReceipt && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
              <div className="font-semibold text-sm border-b pb-1 text-foreground">
                Insumos Recepcionados ({selectedReceipt.orden_compra.proveedor.razon_social}):
              </div>
              <div className="space-y-1">
                {selectedReceipt.detalles_recepcion_compra.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {d.detalle_orden_compra.insumo.nombre} (
                      {Number(d.cantidad_recibida)} {d.detalle_orden_compra.insumo.unidad_medida})
                    </span>
                    <span className="font-mono">
                      S/{" "}
                      {(
                        Number(d.cantidad_recibida) *
                        Number(d.detalle_orden_compra.precio_unitario)
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo_comp">Tipo Voucher</Label>
              <Select value={voucherType} onValueChange={(val) => setVoucherType(val ?? "Factura")}>
                <SelectTrigger id="tipo_comp">
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
              <Label htmlFor="serie">Serie *</Label>
              <Input
                id="serie"
                placeholder="F001"
                maxLength={4}
                value={series}
                onChange={(e) => setSeries(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero">Número *</Label>
              <Input
                id="numero"
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
              <Label htmlFor="fecha_emision">Fecha de Emisión *</Label>
              <Input
                id="fecha_emision"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condicion_pago">Condición de Pago</Label>
              <Select
                value={paymentTerms}
                onValueChange={(val) => setPaymentTerms(val as "Contado" | "Credito")}
              >
                <SelectTrigger id="condicion_pago">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contado">Contado (Pagado ya)</SelectItem>
                  <SelectItem value="Credito">Crédito (Pago pendiente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentTerms === "Contado" && (
            <div className="space-y-1.5">
              <Label htmlFor="tipo_pago">Medio de Pago *</Label>
              <Select
                value={paymentTypeId ? paymentTypeId.toString() : ""}
                onValueChange={(val) => setPaymentTypeId(Number(val))}
              >
                <SelectTrigger id="tipo_pago">
                  <SelectValue placeholder="Seleccionar medio de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((tp) => (
                    <SelectItem key={tp.id_tipo_pago} value={tp.id_tipo_pago.toString()}>
                      {tp.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Readonly Totals */}
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
              <span>Monto Total Voucher:</span>
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
              Guardar Voucher
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
