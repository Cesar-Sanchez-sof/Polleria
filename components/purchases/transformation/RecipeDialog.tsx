"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ProductDialog } from "@/components/purchases/inventory/ProductDialog";
import {
  createTransformationRecipe,
  updateTransformationRecipe,
} from "@/lib/services/purchases/transformation";
import { ProductType } from "@prisma/client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Sparkles, Plus } from "lucide-react";

export interface RecipeProductItem {
  id: number;
  name: string;
  type: ProductType;
  unitOfMeasure: string;
}

export interface TransformationRecipeItem {
  id: number;
  producedProductId: number;
  consumedProductId: number;
  producedQuantity: number;
  requiredQuantity: number;
  active: boolean;
  timesUsed?: number;
  producedProduct: {
    id: number;
    name: string;
    unitOfMeasure: string;
  };
  consumedProduct: {
    id: number;
    name: string;
    unitOfMeasure: string;
  };
}

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: RecipeProductItem[];
  recipeToEdit?: TransformationRecipeItem | null;
  onSuccess?: () => void;
}

export function RecipeDialog({
  open,
  onOpenChange,
  products: initialProducts,
  recipeToEdit,
  onSuccess,
}: RecipeDialogProps) {
  const router = useRouter();
  const [productsList, setProductsList] = useState<RecipeProductItem[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  const [consumedProductId, setConsumedProductId] = useState<number | "">("");
  const [requiredQuantity, setRequiredQuantity] = useState<number | "">(1);
  const [producedProductId, setProducedProductId] = useState<number | "">("");
  const [producedQuantity, setProducedQuantity] = useState<number | "">(8);

  const rawMaterials = productsList.filter((s) => s.type === ProductType.RawMaterial);
  const finishedProducts = productsList.filter((s) => s.type === ProductType.FinishedProduct);

  useEffect(() => {
    setProductsList(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (recipeToEdit) {
      setConsumedProductId(recipeToEdit.consumedProductId);
      setRequiredQuantity(Number(recipeToEdit.requiredQuantity));
      setProducedProductId(recipeToEdit.producedProductId);
      setProducedQuantity(Number(recipeToEdit.producedQuantity));
    } else {
      setConsumedProductId("");
      setRequiredQuantity(1);
      setProducedProductId("");
      setProducedQuantity(8);
    }
  }, [recipeToEdit, open]);

  const selectedConsumed = productsList.find((s) => s.id === Number(consumedProductId));
  const selectedProduced = productsList.find((s) => s.id === Number(producedProductId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consumedProductId) {
      toast.error("Debe seleccionar un insumo consumido (Materia Prima)");
      return;
    }
    if (!producedProductId) {
      toast.error("Debe seleccionar un producto producido (Producto Terminado)");
      return;
    }
    if (Number(consumedProductId) === Number(producedProductId)) {
      toast.error("El insumo producido no puede ser el mismo que el consumido");
      return;
    }
    if (!requiredQuantity || Number(requiredQuantity) <= 0) {
      toast.error("La cantidad requerida debe ser mayor a 0");
      return;
    }
    if (!producedQuantity || Number(producedQuantity) <= 0) {
      toast.error("La cantidad producida debe ser mayor a 0");
      return;
    }

    setLoading(true);
    try {
      if (recipeToEdit) {
        await updateTransformationRecipe(recipeToEdit.id, {
          requiredQuantity: Number(requiredQuantity),
          producedQuantity: Number(producedQuantity),
        });
        toast.success("Receta actualizada exitosamente");
      } else {
        await createTransformationRecipe({
          consumedProductId: Number(consumedProductId),
          producedProductId: Number(producedProductId),
          requiredQuantity: Number(requiredQuantity),
          producedQuantity: Number(producedQuantity),
        });
        toast.success("Receta creada exitosamente");
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar receta");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatedProduct = (created: any) => {
    if (created) {
      setProductsList((prev) => [...prev, created]);
      if (created.type === ProductType.FinishedProduct) {
        setProducedProductId(created.id);
      } else if (created.type === ProductType.RawMaterial) {
        setConsumedProductId(created.id);
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              {recipeToEdit ? "Editar Receta de Transformación" : "Nueva Receta de Transformación"}
            </DialogTitle>
            <DialogDescription>
              Define la proporción de insumos para convertir materia prima en producto terminado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Insumo Consumido */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg border">
              <Label htmlFor="consumedProduct" className="text-xs font-semibold text-rose-700">
                1. Materia Prima *
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Select
                    value={consumedProductId ? consumedProductId.toString() : ""}
                    onValueChange={(val) => setConsumedProductId(Number(val))}
                    disabled={!!recipeToEdit}
                  >
                    <SelectTrigger id="consumedProduct" className="text-xs">
                      <SelectValue placeholder="Seleccionar materia prima">
                        {selectedConsumed ? selectedConsumed.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {rawMaterials.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Cantidad"
                    value={requiredQuantity}
                    onChange={(e) => setRequiredQuantity(parseFloat(e.target.value) || "")}
                    className="text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Insumo Producido */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label htmlFor="producedProduct" className="text-xs font-semibold text-emerald-700">
                  2. Producto Terminado *
                </Label>
                {!recipeToEdit && (
                  <button
                    type="button"
                    onClick={() => setProductDialogOpen(true)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Crear Insumo
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Select
                    value={producedProductId ? producedProductId.toString() : ""}
                    onValueChange={(val) => setProducedProductId(Number(val))}
                    disabled={!!recipeToEdit}
                  >
                    <SelectTrigger id="producedProduct" className="text-xs">
                      <SelectValue placeholder="Seleccionar producto terminado">
                        {selectedProduced ? selectedProduced.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {finishedProducts.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Cantidad"
                    value={producedQuantity}
                    onChange={(e) => setProducedQuantity(parseFloat(e.target.value) || "")}
                    className="text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Vista Previa de la Fórmula */}
            {selectedConsumed && selectedProduced && (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center font-medium">
                Fórmula: {requiredQuantity || 1} {selectedConsumed.name} →{" "}
                {producedQuantity || 1} {selectedProduced.name}
              </div>
            )}

            <DialogFooter>
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
                {recipeToEdit ? "Guardar Cambios" : "Crear Receta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        prefilledType={ProductType.FinishedProduct}
        onSuccess={handleCreatedProduct}
      />
    </>
  );
}
