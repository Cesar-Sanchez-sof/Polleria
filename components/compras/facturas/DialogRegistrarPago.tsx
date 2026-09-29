"use client";

import React, { useState, useEffect } from "react";
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
import { registrarPagoCompra } from "@/lib/services/compras/facturas";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { CreditCard } from "lucide-react";

interface Comprobante {
  id_comprobante_compra: number;
  tipo_comprobante: string;
  serie: string;
  numero: number;
  monto_total: number | string;
  saldoPendiente: number;
  proveedor: {
    razon_social: string;
  };
}

interface TipoPago {
  id_tipo_pago: number;
  nombre: string;
}

interface DialogRegistrarPagoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobante: Comprobante | null;
  tiposPago: TipoPago[];
  onSuccess: () => void;
}

export function DialogRegistrarPago({
  open,
  onOpenChange,
  comprobante,
  tiposPago,
  onSuccess,
}: DialogRegistrarPagoProps) {
  const [loading, setLoading] = useState(false);
  const [monto, setMonto] = useState<number>(0);
  const [idTipoPago, setIdTipoPago] = useState<number | "">(
    tiposPago.length > 0 ? tiposPago[0].id_tipo_pago : ""
  );

  useEffect(() => {
    if (comprobante) {
      setMonto(comprobante.saldoPendiente);
      if (tiposPago.length > 0) {
        setIdTipoPago(tiposPago[0].id_tipo_pago);
      }
    }
  }, [comprobante, open, tiposPago]);

  if (!comprobante) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idTipoPago) {
      toast.error("Debe seleccionar un tipo de pago");
      return;
    }
    if (monto <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    setLoading(true);
    try {
      await registrarPagoCompra(
        comprobante.id_comprobante_compra,
        Number(idTipoPago),
        monto
      );
      toast.success("Pago registrado correctamente");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Registrar Pago a Proveedor
          </DialogTitle>
          <DialogDescription>
            {comprobante.tipo_comprobante} {comprobante.serie}-{comprobante.numero} (
            {comprobante.proveedor.razon_social})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto Total Comprobante:</span>
              <span className="font-semibold">
                S/ {Number(comprobante.monto_total).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo Pendiente Actual:</span>
              <span className="font-semibold text-rose-600">
                S/ {comprobante.saldoPendiente.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto_pago">Monto a Pagar (S/) *</Label>
            <Input
              id="monto_pago"
              type="number"
              step="0.01"
              min="0.01"
              max={comprobante.saldoPendiente}
              value={monto}
              onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo_pago_modal">Medio / Forma de Pago *</Label>
            <Select
              value={idTipoPago ? idTipoPago.toString() : ""}
              onValueChange={(val) => setIdTipoPago(Number(val))}
            >
              <SelectTrigger id="tipo_pago_modal">
                <SelectValue placeholder="Seleccionar tipo de pago" />
              </SelectTrigger>
              <SelectContent>
                {tiposPago.map((tp) => (
                  <SelectItem key={tp.id_tipo_pago} value={tp.id_tipo_pago.toString()}>
                    {tp.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              Guardar Pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
