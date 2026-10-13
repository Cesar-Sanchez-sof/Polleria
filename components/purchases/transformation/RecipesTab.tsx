"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TablePagination } from "@/components/purchases/shared/TablePagination";
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
import {
  toggleTransformationRecipe,
  deleteTransformationRecipe,
} from "@/lib/services/purchases/transformation";
import { toast } from "sonner";
import { Plus, Edit2, Power, ArrowRight, Sparkles, Trash2, AlertTriangle, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [recipeToDelete, setRecipeToDelete] = useState<TransformationRecipeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const paginatedRecipes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return recipes.slice(start, start + pageSize);
  }, [recipes, currentPage, pageSize]);

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

  const handleConfirmDelete = async () => {
    if (!recipeToDelete) return;
    setDeleting(true);
    try {
      await deleteTransformationRecipe(recipeToDelete.id);
      toast.success("Receta eliminada exitosamente");
      setRecipeToDelete(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar la receta");
    } finally {
      setDeleting(false);
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

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Materia Prima (Insumo Base)</TableHead>
              <TableHead className="min-w-[240px]">Transformación</TableHead>
              <TableHead className="min-w-[180px]">Producto Terminado (Resultado)</TableHead>
              <TableHead className="text-center w-[100px] whitespace-nowrap">Estado</TableHead>
              <TableHead className="text-center w-[150px] whitespace-nowrap">Acciones</TableHead>
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
              paginatedRecipes.map((r) => {
                const isToggling = togglingId === r.id;
                const canDelete = r.timesUsed === undefined || r.timesUsed === 0;

                return (
                  <TableRow key={r.id}>
                    {/* 1. Materia Prima (Insumo Consumido) */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/60 dark:border-rose-900/60">
                          <Package className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium text-xs text-foreground">
                          {r.consumedSupply.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* 2. Transformación (Fórmula de Rendimiento) */}
                    <TableCell className="py-3.5">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-2xs">
                        <span className="text-rose-700 dark:text-rose-400 font-bold font-mono">
                          {r.requiredQuantity} {r.consumedSupply.unitOfMeasure}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium px-0.5">
                          rinde
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">
                          {r.producedQuantity} {r.producedSupply.unitOfMeasure}
                        </span>
                      </div>
                    </TableCell>

                    {/* 3. Producto Terminado */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-900/60">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-semibold text-xs text-foreground">
                          {r.producedSupply.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Estado */}
                    <TableCell className="text-center py-3.5 whitespace-nowrap">
                      {r.active ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                          Inactiva
                        </Badge>
                      )}
                    </TableCell>

                    {/* Acciones: Editar y Desactivar centrados bajo el encabezado "Acciones", Eliminar a la derecha */}
                    <TableCell className="py-3.5 whitespace-nowrap text-center">
                      <div className="relative inline-flex items-center justify-center min-w-[72px]">
                        {/* Grupo central: Editar + Desactivar (centrado exactamente con el header 'Acciones') */}
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(r)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="Editar receta"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(r)}
                            disabled={isToggling}
                            className={`h-8 w-8 p-0 rounded-lg cursor-pointer ${
                              r.active
                                ? "text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            }`}
                            title={r.active ? "Desactivar receta" : "Activar receta"}
                          >
                            {isToggling ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {/* Botón Eliminar a la derecha sin alterar el centro */}
                        {canDelete && (
                          <div className="absolute left-full ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRecipeToDelete(r)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg cursor-pointer"
                              title="Eliminar receta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={recipes.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="recetas"
        />
      </div>

      <RecipeDialog
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        supplies={supplies}
        recipeToEdit={selectedRecipeToEdit}
      />

      {/* Diálogo de Confirmación para Eliminar Receta */}
      <Dialog
        open={!!recipeToDelete}
        onOpenChange={(open) => !open && setRecipeToDelete(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Receta de Producción
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar esta receta? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {recipeToDelete && (
            <div className="bg-muted/40 p-3 rounded-md text-xs space-y-1.5 border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producto Terminado:</span>
                <span className="font-semibold text-foreground">
                  {recipeToDelete.producedSupply.name} ({recipeToDelete.producedSupply.unitOfMeasure})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Insumo Consumido:</span>
                <span className="font-semibold text-foreground">
                  {recipeToDelete.consumedSupply.name} ({recipeToDelete.consumedSupply.unitOfMeasure})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ratio:</span>
                <span className="font-semibold font-mono">
                  {recipeToDelete.requiredQuantity} {recipeToDelete.consumedSupply.unitOfMeasure} → {recipeToDelete.producedQuantity} {recipeToDelete.producedSupply.unitOfMeasure}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRecipeToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="flex items-center gap-1.5"
            >
              {deleting ? (
                <>
                  <Spinner className="h-3.5 w-3.5" /> Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar Definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
