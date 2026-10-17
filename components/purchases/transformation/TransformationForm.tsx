"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { executeTransformation } from "@/lib/services/purchases/transformation";
import { toast } from "sonner";
import {
  Repeat,
  Package,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CircleDollarSign,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { TransformationRecipeItem, RecipeProductItem } from "./RecipeDialog";

interface TransformationFormProps {
  recipes: TransformationRecipeItem[];
  products: RecipeProductItem[];
  onGoToRecipesTab?: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function TransformationForm({
  recipes,
  products,
  onGoToRecipesTab,
}: TransformationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Solo recetas activas
  const activeRecipes = useMemo(() => recipes.filter((r) => r.active), [recipes]);

  // Selección de receta (una por producto terminado)
  const [selectedProductId, setSelectedProductId] = useState<number | "">(
    activeRecipes.length > 0 ? activeRecipes[0].productId : ""
  );
  const [quantity, setQuantity] = useState<number | "">(1);
  const [notes, setNotes] = useState("");

  const selectedRecipe = useMemo(() => {
    return activeRecipes.find((r) => r.productId === Number(selectedProductId)) || null;
  }, [activeRecipes, selectedProductId]);

  // Stock vigente del producto a generar (la lista de productos se refresca tras cada lote)
  const producedProduct = useMemo(() => {
    if (!selectedRecipe) return null;
    return products.find((p) => p.id === selectedRecipe.productId) ?? selectedRecipe.product;
  }, [selectedRecipe, products]);

  // Cálculos derivados
  const runQuantity = Math.max(0, Number(quantity) || 0);
  const lines = useMemo(() => {
    if (!selectedRecipe) return [];
    return selectedRecipe.ingredients.map((i) => {
      const live = products.find((p) => p.id === i.ingredientId);
      const available = Number(live?.currentStock ?? i.ingredient.currentStock);
      const unitCost = Number(
        live?.averageCost || live?.lastCost || i.ingredient.averageCost || i.ingredient.lastCost || 0
      );
      const needed = round2(i.quantityRequired * runQuantity);
      return { ...i, available, unitCost, needed, short: available < needed };
    });
  }, [selectedRecipe, products, runQuantity]);

  const hasInsufficientStock = lines.some((l) => l.short);
  const totalConsumedCost = lines.reduce((sum, l) => sum + l.needed * l.unitCost, 0);
  const estimatedProducedUnitCost = runQuantity > 0 ? totalConsumedCost / runQuantity : 0;
  const currentProducedStock = Number(producedProduct?.currentStock ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error("Debe seleccionar una receta de producción");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error("La cantidad a producir debe ser mayor a 0");
      return;
    }
    if (hasInsufficientStock) {
      const missing = lines
        .filter((l) => l.short)
        .map((l) => `${l.ingredient.name} (disponibles ${l.available}, necesarios ${l.needed})`)
        .join("; ");
      toast.error(`Stock insuficiente: ${missing}`);
      return;
    }

    setLoading(true);
    try {
      await executeTransformation(
        Number(selectedProductId),
        Number(quantity),
        notes.trim() || undefined
      );

      toast.success("Transformación ejecutada exitosamente");
      router.refresh();
      setQuantity(1);
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Error al ejecutar transformación");
    } finally {
      setLoading(false);
    }
  };

  if (activeRecipes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20 p-12 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shadow-2xs">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-foreground">No hay recetas de producción activas</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Para producir por lote, primero configura una receta (ej: 1/4 Pollo = 0.25 Pollo entero + 0.2 kg Papas).
          </p>
        </div>
        {onGoToRecipesTab && (
          <Button onClick={onGoToRecipesTab} size="sm" className="h-9 px-4 text-xs font-semibold cursor-pointer">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Configurar Recetas
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Panel de Configuración de Lote ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-900/60 shadow-2xs">
              <Repeat className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Estación de Transformación</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona la receta y cuántas unidades producir para calcular el impacto en inventario.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 px-3 py-1 rounded-full self-start sm:self-auto font-mono">
            {activeRecipes.length} receta{activeRecipes.length > 1 ? "s" : ""} activa{activeRecipes.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector de Receta */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="recipeSelect" className="text-xs font-semibold">
              Producto a producir <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedProductId ? selectedProductId.toString() : ""}
              onValueChange={(val) => setSelectedProductId(Number(val))}
            >
              <SelectTrigger id="recipeSelect" className="h-10 w-full text-xs bg-background">
                <SelectValue placeholder="Seleccionar receta">
                  {selectedRecipe ? selectedRecipe.product.name : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeRecipes.map((r) => (
                  <SelectItem key={r.productId} value={r.productId.toString()}>
                    {r.product.name} — {r.ingredients.map((i) => i.ingredient.name).join(" + ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cantidad a producir */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-xs font-semibold">
              ¿Cuántas unidades producir? <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || "")}
                required
                className="h-10 text-xs font-mono font-bold pr-14 bg-background"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                {producedProduct?.unitOfMeasure}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Previsualización Gráfica del Flujo de Transformación (Ingredientes → Producto) ── */}
      {selectedRecipe && (
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-card via-card to-amber-50/20 dark:to-amber-950/10 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                Flujo del Lote Programado (× {runQuantity})
              </span>
            </div>
            {totalConsumedCost > 0 && (
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />
                Valor estimado: S/ {totalConsumedCost.toFixed(2)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
            {/* INGREDIENTES (CONSUMO / SALIDA) */}
            <div className="lg:col-span-5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 flex items-center justify-center">
                    <Package className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide">
                    Ingredientes a Consumir
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Salida
                </span>
              </div>

              <ul className="divide-y divide-rose-200/60 dark:divide-rose-900/40">
                {lines.map((l) => (
                  <li key={l.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{l.ingredient.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Disponible:{" "}
                        <strong className={l.short ? "text-rose-600 dark:text-rose-400" : "text-foreground"}>
                          {l.available.toFixed(2)} {l.ingredient.unitOfMeasure}
                        </strong>
                        {l.unitCost > 0 && <span className="font-mono"> · S/ {l.unitCost.toFixed(2)} c/u</span>}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-base text-rose-700 dark:text-rose-400 whitespace-nowrap">
                      - {l.needed.toFixed(2)} {l.ingredient.unitOfMeasure}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CONECTOR FLECHA */}
            <div className="lg:col-span-1 flex items-center justify-center py-2 lg:py-0">
              <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center border border-amber-300 dark:border-amber-800 shadow-2xs rotate-90 lg:rotate-0">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>

            {/* PRODUCTO TERMINADO (PRODUCCIÓN / ENTRADA) */}
            <div className="lg:col-span-5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide block">
                      Producto a Generar
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {producedProduct?.name}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Entrada
                </span>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Cantidad Total a Ingresar</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    + {runQuantity.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    {producedProduct?.unitOfMeasure}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Stock actual:{" "}
                  <strong className="text-foreground">
                    {currentProducedStock.toFixed(2)} {producedProduct?.unitOfMeasure}
                  </strong>
                </span>
                {estimatedProducedUnitCost > 0 && (
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    Costo est.: S/ {estimatedProducedUnitCost.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Alerta de Stock Insuficiente */}
          {hasInsufficientStock && (
            <div className="p-3.5 rounded-xl bg-rose-100/80 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="space-y-0.5">
                <p className="font-bold">Stock insuficiente para ejecutar este lote</p>
                <ul className="text-[11px] text-rose-800 dark:text-rose-300">
                  {lines
                    .filter((l) => l.short)
                    .map((l) => (
                      <li key={l.id}>
                        {l.ingredient.name}: disponibles <strong>{l.available.toFixed(2)} {l.ingredient.unitOfMeasure}</strong>,
                        requeridos <strong>{l.needed.toFixed(2)} {l.ingredient.unitOfMeasure}</strong>.
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}

          {!hasInsufficientStock && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 p-2.5 rounded-xl">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Stock disponible verificado. La operación descontará los ingredientes, incrementará el producto terminado en Kardex y registrará el asiento 211 / 241 en el diario.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Observaciones y Ejecución ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-xs font-semibold">
            Observaciones o Notas del Lote (Opcional)
          </Label>
          <Textarea
            id="notes"
            placeholder="Ej: Producción para el turno noche, corte según estándar de cocina, lote #12..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            className="text-xs resize-none bg-background rounded-xl border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            disabled={loading || hasInsufficientStock || runQuantity <= 0}
            className="h-10 px-6 font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            Confirmar y Ejecutar Lote
          </Button>
        </div>
      </div>
    </form>
  );
}
