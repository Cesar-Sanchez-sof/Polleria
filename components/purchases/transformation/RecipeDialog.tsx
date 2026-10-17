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
import { Sparkles, Plus, Trash2 } from "lucide-react";

export interface RecipeProductItem {
  id: number;
  name: string;
  type: ProductType;
  unitOfMeasure: string;
  currentStock?: number;
  averageCost?: number;
  lastCost?: number;
}

export interface RecipeIngredientItem {
  id: number;
  ingredientId: number;
  /** Cantidad del ingrediente por 1 unidad producida. */
  quantityRequired: number;
  ingredient: {
    id: number;
    name: string;
    type: ProductType;
    unitOfMeasure: string;
    currentStock: number;
    averageCost: number;
    lastCost: number;
  };
}

/** Receta de un producto: lo que se consume (ingredientes) para obtener 1 unidad del producto. */
export interface TransformationRecipeItem {
  /** Igual a `productId`: una receta por producto. */
  id: number;
  productId: number;
  active: boolean;
  timesUsed?: number;
  product: {
    id: number;
    name: string;
    type: ProductType;
    unitOfMeasure: string;
    currentStock: number;
    averageCost: number;
    lastCost: number;
  };
  ingredients: RecipeIngredientItem[];
}

interface IngredientRow {
  key: number;
  ingredientId: number | "";
  quantity: number | "";
}

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: RecipeProductItem[];
  /** Productos que ya tienen receta (no se pueden elegir al crear una nueva). */
  usedProductIds?: number[];
  recipeToEdit?: TransformationRecipeItem | null;
  onSuccess?: () => void;
}

let rowKey = 0;
const newRow = (ingredientId: number | "" = "", quantity: number | "" = 1): IngredientRow => ({
  key: ++rowKey,
  ingredientId,
  quantity,
});

export function RecipeDialog({
  open,
  onOpenChange,
  products: initialProducts,
  usedProductIds = [],
  recipeToEdit,
  onSuccess,
}: RecipeDialogProps) {
  const router = useRouter();
  const [productsList, setProductsList] = useState<RecipeProductItem[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  const [productId, setProductId] = useState<number | "">("");
  const [rows, setRows] = useState<IngredientRow[]>([newRow()]);

  useEffect(() => {
    setProductsList(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (recipeToEdit) {
      setProductId(recipeToEdit.productId);
      setRows(recipeToEdit.ingredients.map((i) => newRow(i.ingredientId, Number(i.quantityRequired))));
    } else {
      setProductId("");
      setRows([newRow()]);
    }
  }, [recipeToEdit, open]);

  const finishedProducts = productsList.filter(
    (p) => p.type === ProductType.FinishedProduct && (recipeToEdit || !usedProductIds.includes(p.id))
  );
  const selectedProduct = productsList.find((p) => p.id === Number(productId));
  const ingredientOptions = productsList.filter((p) => p.id !== Number(productId));

  const updateRow = (key: number, patch: Partial<IngredientRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId) {
      toast.error("Debe seleccionar el producto que se obtiene");
      return;
    }
    if (rows.length === 0 || rows.some((r) => !r.ingredientId)) {
      toast.error("Seleccione el ingrediente de cada línea");
      return;
    }
    if (rows.some((r) => !r.quantity || Number(r.quantity) <= 0)) {
      toast.error("La cantidad de cada ingrediente debe ser mayor a 0");
      return;
    }
    const ids = rows.map((r) => Number(r.ingredientId));
    if (new Set(ids).size !== ids.length) {
      toast.error("Hay ingredientes repetidos en la receta");
      return;
    }

    const ingredients = rows.map((r) => ({
      ingredientId: Number(r.ingredientId),
      quantityRequired: Number(r.quantity),
    }));

    setLoading(true);
    try {
      if (recipeToEdit) {
        await updateTransformationRecipe(recipeToEdit.productId, { ingredients });
        toast.success("Receta actualizada exitosamente");
      } else {
        await createTransformationRecipe({ productId: Number(productId), ingredients });
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
        setProductId(created.id);
      }
    }
  };

  const formula = rows
    .map((r) => {
      const ingredient = productsList.find((p) => p.id === Number(r.ingredientId));
      return ingredient && r.quantity ? `${r.quantity} ${ingredient.unitOfMeasure} ${ingredient.name}` : null;
    })
    .filter(Boolean)
    .join(" + ");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              {recipeToEdit ? "Editar Receta" : "Nueva Receta"}
            </DialogTitle>
            <DialogDescription>
              Define qué ingredientes se consumen para obtener 1 unidad del producto terminado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Producto que se obtiene */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label htmlFor="producedProduct" className="text-xs font-semibold text-emerald-700">
                  1. Producto Terminado *
                </Label>
                {!recipeToEdit && (
                  <button
                    type="button"
                    onClick={() => setProductDialogOpen(true)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Crear Producto
                  </button>
                )}
              </div>
              <Select
                value={productId ? productId.toString() : ""}
                onValueChange={(val) => setProductId(Number(val))}
                disabled={!!recipeToEdit}
              >
                <SelectTrigger id="producedProduct" className="text-xs">
                  <SelectValue placeholder="Seleccionar producto terminado">
                    {selectedProduct ? selectedProduct.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {finishedProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ingredientes */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-rose-700">
                  2. Ingredientes por 1 {selectedProduct?.unitOfMeasure ?? "unidad"} *
                </Label>
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, newRow()])}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Agregar ingrediente
                </button>
              </div>

              <div className="space-y-2">
                {rows.map((row) => {
                  const selected = productsList.find((p) => p.id === Number(row.ingredientId));
                  return (
                    <div key={row.key} className="grid grid-cols-[1fr_6.5rem_auto] gap-2 items-center">
                      <Select
                        value={row.ingredientId ? row.ingredientId.toString() : ""}
                        onValueChange={(val) => updateRow(row.key, { ingredientId: Number(val) })}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Seleccionar ingrediente">
                            {selected ? selected.name : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ingredientOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          placeholder="Cantidad"
                          value={row.quantity}
                          onChange={(e) => updateRow(row.key, { quantity: parseFloat(e.target.value) || "" })}
                          className="text-xs pr-9"
                          required
                        />
                        {selected && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                            {selected.unitOfMeasure}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600"
                        aria-label="Quitar ingrediente"
                        disabled={rows.length === 1}
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cantidad por 1 unidad producida. Si 1 pollo rinde 8 presas, cada presa lleva 0.125 de pollo.
              </p>
            </div>

            {/* Vista previa de la fórmula */}
            {selectedProduct && formula && (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center font-medium">
                1 {selectedProduct.unitOfMeasure} {selectedProduct.name} = {formula}
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
