"use client";

import React, { useState } from "react";
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
import { receivePurchase } from "@/lib/services/purchases/receiving";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { PackageCheck } from "lucide-react";

interface OrderItem {
  id: number;
  supplyId: number;
  quantityOrdered: number | string;
  unitPrice: number | string;
  supply: {
    name: string;
    unitOfMeasure: string;
  };
  receiptItems?: Array<{
    quantityReceived: number | string;
  }>;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplier: {
    businessName: string;
  };
  items: OrderItem[];
}

interface ReceivingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder | null;
  onSuccess: () => void;
}

export function ReceivingSheet({
  open,
  onOpenChange,
  order,
  onSuccess,
}: ReceivingSheetProps) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const [prevOrder, setPrevOrder] = useState<{ id: number; open: boolean } | null>(null);

  if (order && (prevOrder?.id !== order.id || prevOrder?.open !== open)) {
    setPrevOrder({ id: order.id, open });
    const initQty: Record<number, number> = {};
    order.items.forEach((d) => {
      const ordered = Number(d.quantityOrdered);
      const alreadyReceived = (d.receiptItems || []).reduce(
        (sum, r) => sum + Number(r.quantityReceived),
        0
      );
      const pending = Math.max(0, ordered - alreadyReceived);
      initQty[d.id] = pending;
    });
    setQuantities(initQty);
    setNote("");
  }

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsToSend = Object.entries(quantities)
      .map(([idStr, qty]) => ({
        purchaseOrderItemId: Number(idStr),
        quantityReceived: Number(qty),
      }))
      .filter((d) => d.quantityReceived > 0);

    if (itemsToSend.length === 0) {
      toast.error("Debe ingresar al menos una cantidad recibida mayor a 0");
      return;
    }

    setLoading(true);
    try {
      await receivePurchase({
        purchaseOrderId: order.id,
        notes: note || undefined,
        items: itemsToSend,
      });
      toast.success(`Recepción registrada para la orden ${order.orderNumber}`);
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
            Recepcionar Orden {order.orderNumber}
          </SheetTitle>
          <SheetDescription>
            Proveedor: <strong>{order.supplier.businessName}</strong>. Ingresa la
            cantidad física de insumos recibida en almacén.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-1">Líneas de la Orden</h3>
            {order.items.map((d) => {
              const ordered = Number(d.quantityOrdered);
              const alreadyReceived = (d.receiptItems || []).reduce(
                (sum, r) => sum + Number(r.quantityReceived),
                0
              );
              const pending = Math.max(0, ordered - alreadyReceived);

              return (
                <div
                  key={d.id}
                  className="rounded-lg border bg-card p-3 space-y-2 text-sm"
                >
                  <div className="flex justify-between font-medium">
                    <span>{d.supply.name}</span>
                    <span className="text-xs text-muted-foreground">
                      P.U: S/ {Number(d.unitPrice).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>Pedida: {ordered} {d.supply.unitOfMeasure}</div>
                    <div>Ya recibida: {alreadyReceived} {d.supply.unitOfMeasure}</div>
                    <div className="font-semibold text-foreground">
                      Pendiente: {pending} {d.supply.unitOfMeasure}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-3">
                    <Label
                      htmlFor={`qty-${d.id}`}
                      className="text-xs font-semibold shrink-0"
                    >
                      Cant. Recibida Ahora ({d.supply.unitOfMeasure}):
                    </Label>
                    <Input
                      id={`qty-${d.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max={pending}
                      value={quantities[d.id] ?? 0}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [d.id]: parseFloat(e.target.value) || 0,
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
            <Label htmlFor="receiptNotes">Observaciones de Recepción</Label>
            <Textarea
              id="receiptNotes"
              placeholder="Ej: Empaque sellado, faltan 2 sacos de papa por deterioro..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
