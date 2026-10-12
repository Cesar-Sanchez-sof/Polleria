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
import { Repeat, Package, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { TransformationRecipeItem, RecipeSupplyItem } from "./RecipeDialog";

interface TransformationFormProps {
  recipes: TransformationRecipeItem[];
  supplies: RecipeSupplyItem[];
  onGoToRecipesTab?: () => void;
}

export function TransformationForm({
  recipes,
  supplies,
  onGoToRecipesTab,
}: TransformationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Solo recetas activas
  const activeRecipes = useMemo(() => recipes.filter((r) => r.active), [recipes]);

  // Selección de receta
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | "">(
    activeRecipes.length > 0 ? activeRecipes[0].id : ""
  );
  const [times, setTimes] = useState<number | "">(1);
  const [notes, setNotes] = useState("");

  const selectedRecipe = useMemo(() => {
    return activeRecipes.find((r) => r.id === Number(selectedRecipeId)) || null;
  }, [activeRecipes, selectedRecipeId]);

  // Datos del insumo consumido en tiempo real
  const consumedSupply = useMemo(() => {
    if (!selectedRecipe) return null;
    return (
      supplies.find((s) => s.id === selectedRecipe.consumedSupplyId) ||
      selectedRecipe.consumedSupply
    );
  }, [selectedRecipe, supplies]);

  const producedSupply = useMemo(() => {
    if (!selectedRecipe) return null;
    return (
      supplies.find((s) => s.id === selectedRecipe.producedSupplyId) ||
      selectedRecipe.producedSupply
    );
  }, [selectedRecipe, supplies]);

  // Cálculos derivados
  const runTimes = Math.max(1, Number(times) || 1);
  const totalConsumed = selectedRecipe ? Number(selectedRecipe.requiredQuantity) * runTimes : 0;
  const totalProduced = selectedRecipe ? Number(selectedRecipe.producedQuantity) * runTimes : 0;

  const currentAvailableStock = Number((consumedSupply as any)?.currentStock || 0);
  const hasInsufficientStock = selectedRecipe ? currentAvailableStock < totalConsumed : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRecipeId) {
      toast.error("Debe seleccionar una receta de transformación");
      return;
    }
    if (!times || Number(times) <= 0) {
      toast.error("La cantidad de veces a ejecutar debe ser mayor a 0");
      return;
    }
    if (hasInsufficientStock) {
      toast.error(
        `Stock insuficiente. Disponibles: ${currentAvailableStock}, necesarios: ${totalConsumed}`
      );
      return;
    }

    setLoading(true);
    try {
      await executeTransformation(
        Number(selectedRecipeId),
        Number(times),
        notes.trim() || undefined
      );

      toast.success("Transformación ejecutada exitosamente");
      router.refresh();
      setTimes(1);
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Error al ejecutar transformación");
    } finally {
      setLoading(false);
    }
  };

  if (activeRecipes.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">No hay recetas de transformación activas</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Para ejecutar una transformación por lote, primero debes configurar una receta (ej: 1 Pollo entero → 8 Presas de pollo).
          </p>
        </div>
        {onGoToRecipesTab && (
          <Button onClick={onGoToRecipesTab} size="sm" className="h-8 text-xs">
            Configurar Recetas
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 space-y-5 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-semibold">Ejecutar Transformación por Lote</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {activeRecipes.length} receta{activeRecipes.length > 1 ? "s" : ""} disponible{activeRecipes.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selector de Receta */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="recipeSelect">Seleccionar Receta de Producción *</Label>
          <Select
            value={selectedRecipeId ? selectedRecipeId.toString() : ""}
            onValueChange={(val) => setSelectedRecipeId(Number(val))}
          >
            <SelectTrigger id="recipeSelect">
              <SelectValue placeholder="Seleccionar receta" />
            </SelectTrigger>
            <SelectContent>
              {activeRecipes.map((r) => (
                <SelectItem key={r.id} value={r.id.toString()}>
                  {r.requiredQuantity} {r.consumedSupply.name} ({r.consumedSupply.unitOfMeasure}) →{" "}
                  {r.producedQuantity} {r.producedSupply.name} ({r.producedSupply.unitOfMeasure})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Multiplicador (Veces) */}
        <div className="space-y-1.5">
          <Label htmlFor="times">¿Cuántas veces ejecutar? *</Label>
          <Input
            id="times"
            type="number"
            min="1"
            step="1"
            value={times}
            onChange={(e) => setTimes(parseInt(e.target.value) || "")}
            required
          />
        </div>
      </div>

      {/* Previsualización en vivo del Lote */}
      {selectedRecipe && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/40 border">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-2 border-b">
            <span>Previsualización del Lote a Producir</span>
            <span className="text-foreground">Lote × {runTimes}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Consumo */}
            <div className="p-3 rounded bg-rose-50/60 border border-rose-200/60 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-800 font-semibold">
                <Package className="h-4 w-4" /> Se consumirá:
              </div>
              <div className="text-base font-bold text-rose-900">
                - {totalConsumed.toFixed(2)} {consumedSupply?.unitOfMeasure || ""}
              </div>
              <p className="text-[11px] text-muted-foreground">
                De: {consumedSupply?.name || ""} (Disponible: {currentAvailableStock.toFixed(2)}{" "}
                {consumedSupply?.unitOfMeasure || ""})
              </p>
            </div>

            {/* Producción */}
            <div className="p-3 rounded bg-emerald-50/60 border border-emerald-200/60 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <Sparkles className="h-4 w-4" /> Se producirá:
              </div>
              <div className="text-base font-bold text-emerald-900">
                + {totalProduced.toFixed(2)} {producedSupply?.unitOfMeasure || ""}
              </div>
              <p className="text-[11px] text-muted-foreground">
                De: {producedSupply?.name || ""} (Stock actual:{" "}
                {Number((producedSupply as any)?.currentStock || 0).toFixed(2)}{" "}
                {producedSupply?.unitOfMeasure || ""})
              </p>
            </div>
          </div>

          {/* Alerta de Stock Insuficiente */}
          {hasInsufficientStock && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span>
                <strong>Stock insuficiente:</strong> No puedes ejecutar esta transformación.
                Disponibles: {currentAvailableStock.toFixed(2)}, necesarios: {totalConsumed.toFixed(2)}.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Observaciones */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observaciones / Notas (Opcional)</Label>
        <Textarea
          id="notes"
          placeholder="Ej: Producción para el turno noche, corte según estándar de cocina..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={200}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={loading || hasInsufficientStock}
          className="flex items-center gap-2"
        >
          {loading && <Spinner className="h-4 w-4" />}
          Ejecutar Transformación
        </Button>
      </div>
    </form>
  );
}
