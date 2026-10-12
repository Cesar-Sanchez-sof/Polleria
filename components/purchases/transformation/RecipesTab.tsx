"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  RecipeDialog,
  RecipeSupplyItem,
  TransformationRecipeItem,
} from "./RecipeDialog";
import { toggleTransformationRecipe } from "@/lib/services/purchases/transformation";
import { toast } from "sonner";
import { Plus, Edit2, Power, ArrowRight, Sparkles } from "lucide-react";

interface RecipesTabProps {
  recipes: TransformationRecipeItem[];
  supplies: RecipeSupplyItem[];
}

export function RecipesTab({ recipes, supplies }: RecipesTabProps) {
  const router = useRouter();
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [selectedRecipeToEdit, setSelectedRecipeToEdit] =
    useState<TransformationRecipeItem | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const handleOpenCreate = () => {
    setSelectedRecipeToEdit(null);
    setRecipeDialogOpen(true);
  };

  const handleOpenEdit = (recipe: TransformationRecipeItem) => {
    setSelectedRecipeToEdit(recipe);
    setRecipeDialogOpen(true);
  };

  const handleToggleActive = async (recipe: TransformationRecipeItem) => {
    setTogglingId(recipe.id);
    try {
      await toggleTransformationRecipe(recipe.id, !recipe.active);
      toast.success(
        `Receta ${!recipe.active ? "activada" : "desactivada"} exitosamente`
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado de la receta");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-lg p-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Recetas de Producción Configuradas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura proporciones predeterminadas de transformación para ejecutarlas por lote.
          </p>
        </div>

        <Button onClick={handleOpenCreate} size="sm" className="h-8 text-xs flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nueva Receta
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto Terminado</TableHead>
              <TableHead>Insumo Consumido</TableHead>
              <TableHead className="text-center">Proporción / Ratio</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  No hay recetas de transformación configuradas. Pulsa &quot;Nueva Receta&quot; para crear la primera.
                </TableCell>
              </TableRow>
            ) : (
              recipes.map((r) => {
                const isToggling = togglingId === r.id;

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-xs">
                      {r.producedSupply.name}
                      <span className="text-[11px] text-muted-foreground ml-1">
                        ({r.producedSupply.unitOfMeasure})
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.consumedSupply.name}
                      <span className="text-[11px] text-muted-foreground ml-1">
                        ({r.consumedSupply.unitOfMeasure})
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      <span className="inline-flex items-center gap-1.5 font-mono px-2 py-0.5 rounded bg-muted/60 border text-[11px]">
                        <strong>{r.requiredQuantity}</strong> {r.consumedSupply.unitOfMeasure}{" "}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />{" "}
                        <strong className="text-emerald-700">{r.producedQuantity}</strong>{" "}
                        {r.producedSupply.unitOfMeasure}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.active ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                          Inactiva
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(r)}
                          className="h-7 w-7 p-0"
                          title="Editar cantidades"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(r)}
                          disabled={isToggling}
                          className={`h-7 px-2 text-xs flex items-center gap-1 ${
                            r.active ? "text-amber-700 hover:text-amber-800" : "text-emerald-700 hover:text-emerald-800"
                          }`}
                        >
                          {isToggling ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {r.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <RecipeDialog
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        supplies={supplies}
        recipeToEdit={selectedRecipeToEdit}
      />
    </div>
  );
}
