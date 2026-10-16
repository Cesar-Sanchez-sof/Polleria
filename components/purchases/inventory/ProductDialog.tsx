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
import { createProduct, ProductInput } from "@/lib/services/purchases/product";
import { ProductType, AffectationIgv } from "@prisma/client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

const SUPPLY_TYPE_LABELS: Record<ProductType, string> = {
  [ProductType.RawMaterial]: "Materia Prima",
  [ProductType.FinishedProduct]: "Producto Terminado",
};

const AFFECTATION_LABELS: Record<AffectationIgv, string> = {
  [AffectationIgv.Excluded]: "Excluido",
  [AffectationIgv.Included]: "Incluido",
};

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdProduct: any) => void;
  prefilledName?: string;
  prefilledType?: ProductType;
  prefilledAffectationIgv?: AffectationIgv | null;
  showAffectationIgv?: boolean;
}

export function ProductDialog({
  open,
  onOpenChange,
  onSuccess,
  prefilledName = "",
  prefilledType = ProductType.RawMaterial,
  prefilledAffectationIgv,
  showAffectationIgv = false,
}: ProductDialogProps) {
  const defaultAffectation = showAffectationIgv
    ? (prefilledAffectationIgv ?? null)
    : null;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductInput>({
    name: prefilledName,
    type: prefilledType,
    affectationIgv: defaultAffectation,
    unitOfMeasure: "KG",
    minimumStock: prefilledType === ProductType.FinishedProduct ? 0 : 5,
    sellable: false,
    price: null,
  });

  React.useEffect(() => {
    if (open) {
      setFormData({
        name: prefilledName,
        type: prefilledType,
        affectationIgv: defaultAffectation,
        unitOfMeasure: "KG",
        minimumStock: prefilledType === ProductType.FinishedProduct ? 0 : 5,
        sellable: false,
        price: null,
      });
    }
  }, [open, prefilledName, prefilledType, defaultAffectation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: ProductInput = {
        ...formData,
        affectationIgv: showAffectationIgv ? (formData.affectationIgv ?? null) : null,
      };
      const created = await createProduct(payload);
      toast.success("Producto creado exitosamente");
      onSuccess(created);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al crear producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Nuevo Insumo</DialogTitle>
          <DialogDescription>
            Crea un nuevo insumo. El stock inicial siempre comienza en 0.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nombre del Insumo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ej: Pollo Entero, Papa Amarilla, Aceite"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {!showAffectationIgv ? (
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipo de Producto</Label>
              <Select
                value={formData.type}
                onValueChange={(val) => {
                  const newType = val as ProductType;
                  setFormData((prev) => ({
                    ...prev,
                    type: newType,
                    minimumStock:
                      newType === ProductType.FinishedProduct
                        ? 0
                        : prev.minimumStock === 0
                          ? 5
                          : prev.minimumStock,
                  }));
                }}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo">
                    {formData.type ? SUPPLY_TYPE_LABELS[formData.type] : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-(--anchor-width)">
                  <SelectItem value={ProductType.RawMaterial}>Materia Prima</SelectItem>
                  <SelectItem value={ProductType.FinishedProduct}>
                    Producto Terminado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type">Tipo de Producto</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => {
                    const newType = val as ProductType;
                    setFormData((prev) => ({
                      ...prev,
                      type: newType,
                      minimumStock:
                        newType === ProductType.FinishedProduct
                          ? 0
                          : prev.minimumStock === 0
                            ? 5
                            : prev.minimumStock,
                    }));
                  }}
                >
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Seleccionar tipo">
                      {formData.type ? SUPPLY_TYPE_LABELS[formData.type] : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    <SelectItem value={ProductType.RawMaterial}>Materia Prima</SelectItem>
                    <SelectItem value={ProductType.FinishedProduct}>
                      Producto Terminado
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="affectationIgv">Afectación IGV</Label>
                <Select
                  value={formData.affectationIgv || "NONE"}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      affectationIgv: val === "NONE" ? null : (val as AffectationIgv),
                    })
                  }
                >
                  <SelectTrigger id="affectationIgv" className="w-full">
                    <SelectValue placeholder="Seleccionar afectación">
                      {formData.affectationIgv
                        ? AFFECTATION_LABELS[formData.affectationIgv]
                        : "Sin afectación"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    <SelectItem value="NONE">Sin afectación</SelectItem>
                    <SelectItem value={AffectationIgv.Excluded}>Excluido</SelectItem>
                    <SelectItem value={AffectationIgv.Included}>Incluido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="unitOfMeasure">
                Unidad de Medida <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unitOfMeasure"
                placeholder="KG, UND, LT, PAQ"
                value={formData.unitOfMeasure}
                onChange={(e) =>
                  setFormData({ ...formData, unitOfMeasure: e.target.value.toUpperCase() })
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minimumStock">Stock Mínimo de Alerta</Label>
              <Input
                id="minimumStock"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumStock}
                onChange={(e) =>
                  setFormData({ ...formData, minimumStock: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(formData.sellable)}
                  onChange={(e) => setFormData({ ...formData, sellable: e.target.checked })}
                  className="h-4 w-4 accent-blue-700"
                />
                Se vende en la carta (lo ven el mozo y la cocina)
              </label>
              {formData.sellable && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="price">Precio de venta (S/)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.10"
                    min="0.01"
                    value={formData.price ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value === "" ? null : parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
              )}
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
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              Guardar Producto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
