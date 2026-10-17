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
import { registerInventoryAdjustment } from "@/lib/services/purchases/product";
import { InventoryMovementType } from "@prisma/client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface Product {
  id: number;
  name: string;
  unitOfMeasure: string;
  currentStock: number | string;
}

interface AdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: (updatedProduct: any) => void;
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: AdjustmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [movementType, setMovementType] = useState<InventoryMovementType>(
    InventoryMovementType.Adjustment
  );
  const [actualQty, setActualQty] = useState<number>(0);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (product) {
      setActualQty(Number(product.currentStock));
      setMovementType(InventoryMovementType.Adjustment);
      setReason("");
    }
  }, [product, open]);

  if (!product) return null;

  const currentStockNum = Number(product.currentStock);
  const difference = actualQty - currentStockNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("El motivo del ajuste o merma es obligatorio");
      return;
    }
    setLoading(true);
    try {
      const { product: updatedProduct } = await registerInventoryAdjustment(
        product.id,
        actualQty,
        reason,
        movementType
      );
      toast.success(
        `${movementType === InventoryMovementType.Shrinkage ? "Merma" : "Ajuste"} de inventario registrado correctamente`
      );
      onSuccess(updatedProduct);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al registrar ajuste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar Ajuste / Merma de Inventario</DialogTitle>
          <DialogDescription>
            Ajusta el stock real para el insumo <strong>{product.name}</strong>. Se
            generará un movimiento en el Kardex por la diferencia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock Sistema Actual:</span>
              <span className="font-semibold">
                {currentStockNum.toFixed(2)} {product.unitOfMeasure}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diferencia calculada:</span>
              <span
                className={`font-semibold ${
                  difference > 0
                    ? "text-emerald-600"
                    : difference < 0
                    ? "text-rose-600"
                    : "text-muted-foreground"
                }`}
              >
                {difference > 0 ? `+${difference.toFixed(2)}` : difference.toFixed(2)}{" "}
                {product.unitOfMeasure}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="movementType">Tipo de Registro *</Label>
            <Select
              value={movementType}
              onValueChange={(val) => setMovementType(val as InventoryMovementType)}
            >
              <SelectTrigger id="movementType" className="w-full">
                <SelectValue placeholder="Seleccionar tipo">
                  {movementType === InventoryMovementType.Adjustment
                    ? "Ajuste de Inventario"
                    : movementType === InventoryMovementType.Shrinkage
                    ? "Merma de Inventario"
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-(--anchor-width) min-w-[320px]">
                <SelectItem value={InventoryMovementType.Adjustment}>
                  Ajuste de Inventario (Conteo físico / Diferencia)
                </SelectItem>
                <SelectItem value={InventoryMovementType.Shrinkage}>
                  Merma (Vencimiento / Deterioro / Rotura)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actualQuantity">Stock Físico Real Encontrado *</Label>
            <Input
              id="actualQuantity"
              type="number"
              step="0.01"
              min="0"
              value={actualQty}
              onChange={(e) => setActualQty(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo / Justificación *</Label>
            <Input
              id="reason"
              placeholder={
                movementType === InventoryMovementType.Shrinkage
                  ? "Ej: Descomposición por corte de luz, envase quebrado"
                  : "Ej: Conteo físico mensual, corrección de inventario"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
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
              Confirmar Registro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
