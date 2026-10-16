"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  RecipeDialog,
  RecipeProductItem,
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
  products: RecipeProductItem[];
}

export function RecipesTab({ recipes, products }: RecipesTabProps) {
  const router = useRouter();
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [selectedRecipeToEdit, setSelectedRecipeToEdit] =
    useState<TransformationRecipeItem | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<TransformationRecipeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const columns: DataTableColumn<TransformationRecipeItem>[] = [
    {
      key: "consumed",
      header: "Materia Prima (Insumo Base)",
      width: "min-w-[200px]",
      sortable: true,
      sortValue: (r) => r.consumedProduct.name,
      primary: { title: (r) => r.consumedProduct.name, icon: <Package />, iconTone: "rose" },
    },
    {
      key: "formula",
      header: "Transformación",
      width: "min-w-[260px]",
      cell: (r) => (
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
            {r.requiredQuantity} {r.consumedProduct.unitOfMeasure}
          </span>
          <span className="px-0.5 text-[11px] font-medium text-muted-foreground">rinde</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
            {r.producedQuantity} {r.producedProduct.unitOfMeasure}
          </span>
        </div>
      ),
    },
    {
      key: "produced",
      header: "Producto Terminado (Resultado)",
      width: "min-w-[220px]",
      sortable: true,
      sortValue: (r) => r.producedProduct.name,
      primary: { title: (r) => r.producedProduct.name, icon: <Sparkles />, iconTone: "emerald" },
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-28",
      sortable: true,
      sortValue: (r) => (r.active ? 1 : 0),
      cell: (r) => (
        <StatusBadge tone={r.active ? "success" : "neutral"} size="sm">
          {r.active ? "Activa" : "Inactiva"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-36",
      cell: (r) => {
        const isToggling = togglingId === r.id;
        const canDelete = r.timesUsed === undefined || r.timesUsed === 0;
        return (
          <RowActions
            size="sm"
            actions={[
              { key: "edit", label: "Editar receta", icon: <Edit2 />, onClick: () => handleOpenEdit(r) },
              {
                key: "toggle",
                label: r.active ? "Desactivar receta" : "Activar receta",
                icon: isToggling ? <Spinner /> : <Power />,
                tone: r.active ? "amber" : "emerald",
                disabled: isToggling,
                onClick: () => handleToggleActive(r),
              },
              { key: "delete", label: "Eliminar receta", icon: <Trash2 />, tone: "rose", hidden: !canDelete, onClick: () => setRecipeToDelete(r) },
            ]}
          />
        );
      },
    },
  ];

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

      <DataTable
        columns={columns}
        rows={recipes}
        rowKey={(r) => r.id}
        pagination={{ defaultPageSize: 15, itemLabel: "recetas" }}
        emptyState={{
          icon: <Sparkles className="h-7 w-7" />,
          title: "No hay recetas de transformación configuradas.",
          description: "Pulsa \"Nueva Receta\" para crear la primera.",
        }}
      />

      <RecipeDialog
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        products={products}
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
                  {recipeToDelete.producedProduct.name} ({recipeToDelete.producedProduct.unitOfMeasure})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Insumo Consumido:</span>
                <span className="font-semibold text-foreground">
                  {recipeToDelete.consumedProduct.name} ({recipeToDelete.consumedProduct.unitOfMeasure})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ratio:</span>
                <span className="font-semibold font-mono">
                  {recipeToDelete.requiredQuantity} {recipeToDelete.consumedProduct.unitOfMeasure} → {recipeToDelete.producedQuantity} {recipeToDelete.producedProduct.unitOfMeasure}
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
