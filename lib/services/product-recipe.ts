export interface RecipeRow {
  id: number;
  ingredientId: number;
  quantityRequired: unknown;
  ingredient?: {
    name: string;
    unitOfMeasure: string;
    lastCost: unknown;
    averageCost: unknown;
  } | null;
}

/** Receta referencial de un producto con el costo estimado de sus ingredientes (no mueve stock). */
export function mapRecipe(rows: readonly RecipeRow[]) {
  const recipe = rows.map((r) => {
    const unitCost = Number(r.ingredient?.averageCost || r.ingredient?.lastCost || 0);
    return {
      id: r.id,
      ingredientId: r.ingredientId,
      quantityRequired: Number(r.quantityRequired),
      ingredientName: r.ingredient?.name ?? "",
      unitOfMeasure: r.ingredient?.unitOfMeasure ?? "UND",
      costPerUnit: unitCost,
      estimatedCost: Number(r.quantityRequired) * unitCost,
    };
  });
  const recipeCost = Math.round(recipe.reduce((sum, r) => sum + r.estimatedCost, 0) * 100) / 100;
  return { recipe, recipeCost };
}
