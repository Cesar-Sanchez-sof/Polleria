"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recepcionarCompra } from "@/lib/services/compras/recepcion";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { PackageCheck } from "lucide-react";

interface DetalleOrden {
  id_detalle_orden_compra: number;
  id_insumo: number;
  cantidad_pedida: number | string;
  precio_unitario: number | string;
  insumo: {
    nombre: string;
    unidad_medida: string;
  };
  detalles_recepcion_compra?: Array<{
    cantidad_recibida: number | string;
  }>;
}

interface OrdenCompra {
  id_orden_compra: number;
  numero_orden: string;
  proveedor: {
    razon_social: string;
  };
  detalles_orden: DetalleOrden[];
}

interface SheetRecepcionarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: OrdenCompra | null;
  onSuccess: () => void;
}

export function SheetRecepcionar({
  open,
  onOpenChange,
  orden,
  onSuccess,
}: SheetRecepcionarProps) {
  const [loading, setLoading] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const [prevOrden, setPrevOrden] = useState<{ id: number; open: boolean } | null>(null);

  if (orden && (prevOrden?.id !== orden.id_orden_compra || prevOrden?.open !== open)) {
    setPrevOrden({ id: orden.id_orden_compra, open });
    const initCant: Record<number, number> = {};
    orden.detalles_orden.forEach((d) => {
      const ped = Number(d.cantidad_pedida);
      const yaRecibido = (d.detalles_recepcion_compra || []).reduce(
        (sum, r) => sum + Number(r.cantidad_recibida),
        0
      );
      const pendiente = Math.max(0, ped - yaRecibido);
      initCant[d.id_detalle_orden_compra] = pendiente;
    });
    setCantidades(initCant);
    setObservacion("");
  }

  if (!orden) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const detallesAEnviar = Object.entries(cantidades)
      .map(([idStr, cant]) => ({
        id_detalle_orden_compra: Number(idStr),
        cantidad_recibida: Number(cant),
      }))
      .filter((d) => d.cantidad_recibida > 0);

    if (detallesAEnviar.length === 0) {
      toast.error("Debe ingresar al menos una cantidad recibida mayor a 0");
      return;
    }

    setLoading(true);
    try {
      await recepcionarCompra({
        id_orden_compra: orden.id_orden_compra,
        observacion: observacion || undefined,
        detalles: detallesAEnviar,
      });
      toast.success(`Recepción registrada para la orden ${orden.numero_orden}`);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Error al recepcionar la compra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Recepcionar Orden {orden.numero_orden}
          </SheetTitle>
          <SheetDescription>
            Proveedor: <strong>{orden.proveedor.razon_social}</strong>. Ingresa la
            cantidad física de insumos recibida en almacén.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-1">Líneas de la Orden</h3>
            {orden.detalles_orden.map((d) => {
              const pedida = Number(d.cantidad_pedida);
              const yaRecibido = (d.detalles_recepcion_compra || []).reduce(
                (sum, r) => sum + Number(r.cantidad_recibida),
                0
              );
              const pendiente = Math.max(0, pedida - yaRecibido);

              return (
                <div
                  key={d.id_detalle_orden_compra}
                  className="rounded-lg border bg-card p-3 space-y-2 text-sm"
                >
                  <div className="flex justify-between font-medium">
                    <span>{d.insumo.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      P.U: S/ {Number(d.precio_unitario).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>Pedida: {pedida} {d.insumo.unidad_medida}</div>
                    <div>Ya recibida: {yaRecibido} {d.insumo.unidad_medida}</div>
                    <div className="font-semibold text-foreground">
                      Pendiente: {pendiente} {d.insumo.unidad_medida}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-3">
                    <Label
                      htmlFor={`cant-${d.id_detalle_orden_compra}`}
                      className="text-xs font-semibold shrink-0"
                    >
                      Cant. Recibida Ahora ({d.insumo.unidad_medida}):
                    </Label>
                    <Input
                      id={`cant-${d.id_detalle_orden_compra}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max={pendiente}
                      value={cantidades[d.id_detalle_orden_compra] ?? 0}
                      onChange={(e) =>
                        setCantidades({
                          ...cantidades,
                          [d.id_detalle_orden_compra]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs_recepcion">Observaciones de Recepción</Label>
            <Textarea
              id="obs_recepcion"
              placeholder="Ej: Empaque sellado, faltan 2 sacos de papa por deterioro..."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
            />
          </div>

          <SheetFooter className="pt-4 border-t">
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
              Confirmar Recepción
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
