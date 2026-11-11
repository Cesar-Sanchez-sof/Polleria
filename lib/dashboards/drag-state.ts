import type { CatalogField } from "@/lib/hooks/use-visual-data";

let currentDraggedField: CatalogField | null = null;

export function setDraggedField(field: CatalogField | null) {
  currentDraggedField = field;
}

export function getDraggedField(): CatalogField | null {
  return currentDraggedField;
}
