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
import { crearComprobanteCompra, ComprobanteCompraInput } from "@/lib/services/compras/facturas";
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

interface TipoPago {
  id_tipo_pago: number;
  nombre: string;
}

interface DialogNuevoComprobanteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recepcionesSinComprobante: RecepcionSinComprobante[];
  tiposPago: TipoPago[];
  onSuccess: () => void;
}

export function DialogNuevoComprobante({
  open,
  onOpenChange,
  recepcionesSinComprobante,
  tiposPago,
  onSuccess,
}: DialogNuevoComprobanteProps) {
  const [loading, setLoading] = useState(false);
  const [idRecepcion, setIdRecepcion] = useState<number | "">("");
  const [tipoComprobante, setTipoComprobante] = useState<string>("Factura");
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState<number | "">("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [condicionPago, setCondicionPago] = useState<"Contado" | "Credito">("Contado");
  const [idTipoPago, setIdTipoPago] = useState<number | "">(
    tiposPago.length > 0 ? tiposPago[0].id_tipo_pago : ""
  );

  const recepcionSel = recepcionesSinComprobante.find(
    (r) => r.id_recepcion === Number(idRecepcion)
  );

  // Calculations for chosen reception
  let subtotal = 0;
  if (recepcionSel) {
    recepcionSel.detalles_recepcion_compra.forEach((d) => {
      const cant = Number(d.cantidad_recibida);
      const prec = Number(d.detalle_orden_compra.precio_unitario);
      subtotal += cant * prec;
    });
  }
  const igv = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + igv;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idRecepcion || !recepcionSel) {
      toast.error("Debe seleccionar una recepción de compra");
      return;
    }
    if (!serie.trim() || !numero) {
      toast.error("Debe ingresar la serie y número del comprobante");
      return;
    }
    if (condicionPago === "Contado" && !idTipoPago) {
      toast.error("Debe seleccionar el tipo de pago para venta al contado");
      return;
    }

    setLoading(true);
    try {
      await crearComprobanteCompra({
        id_proveedor: recepcionSel.orden_compra.proveedor.id_proveedor,
        id_recepcion: Number(idRecepcion),
        tipo_comprobante: tipoComprobante,
        serie: serie.toUpperCase().trim(),
        numero: Number(numero),
        fecha_emision: fechaEmision,
        condicion_pago: condicionPago,
        id_tipo_pago: condicionPago === "Contado" ? Number(idTipoPago) : undefined,
      });

      toast.success(`${tipoComprobante} registrada exitosamente`);
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
              value={idRecepcion ? idRecepcion.toString() : ""}
              onValueChange={(val) => setIdRecepcion(Number(val))}
            >
              <SelectTrigger id="recepcion">
                <SelectValue placeholder="Seleccionar Recepción">
                  {recepcionSel
                    ? `Recepción #${recepcionSel.id_recepcion} - ${recepcionSel.orden_compra.proveedor.razon_social} (Ord #${recepcionSel.orden_compra.numero_orden})`
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {recepcionesSinComprobante.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay recepciones pendientes de factura
                  </SelectItem>
                ) : (
                  recepcionesSinComprobante.map((r) => (
                    <SelectItem key={r.id_recepcion} value={r.id_recepcion.toString()}>
                      Recepción #{r.id_recepcion} - {r.orden_compra.proveedor.razon_social} (Ord #{r.orden_compra.numero_orden})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {recepcionSel && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
              <div className="font-semibold text-sm border-b pb-1 text-foreground">
                Insumos Recepcionados ({recepcionSel.orden_compra.proveedor.razon_social}):
              </div>
              <div className="space-y-1">
                {recepcionSel.detalles_recepcion_compra.map((d, i) => (
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
              <Label htmlFor="tipo_comp">Tipo Comprobante</Label>
              <Select value={tipoComprobante} onValueChange={(val) => setTipoComprobante(val ?? "Factura")}>
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
                value={serie}
                onChange={(e) => setSerie(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero">Número *</Label>
              <Input
                id="numero"
                type="number"
                placeholder="12345"
                value={numero}
                onChange={(e) => setNumero(parseInt(e.target.value) || "")}
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
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condicion_pago">Condición de Pago</Label>
              <Select
                value={condicionPago}
                onValueChange={(val) => setCondicionPago(val as "Contado" | "Credito")}
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

          {condicionPago === "Contado" && (
            <div className="space-y-1.5">
              <Label htmlFor="tipo_pago">Medio de Pago *</Label>
              <Select
                value={idTipoPago ? idTipoPago.toString() : ""}
                onValueChange={(val) => setIdTipoPago(Number(val))}
              >
                <SelectTrigger id="tipo_pago">
                  <SelectValue placeholder="Seleccionar medio de pago" />
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
            <Button type="submit" disabled={loading || !recepcionSel}>
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              Guardar Comprobante
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
