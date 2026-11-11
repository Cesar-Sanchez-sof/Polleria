import type { WidgetConfig, VisualType } from "./widget-schema";
import { migrateWidgetConfigByRole } from "./visual-registry";

/**
 * Matriz de compatibilidad entre tipos de visualización estilo Power BI.
 * Delega en la única fuente de verdad: el registro de visualizaciones (lib/dashboards/visual-registry.ts).
 */
export function migrateWidgetConfigOnVisualTypeChange(
  currentConfig: WidgetConfig,
  newVisualType: VisualType
): WidgetConfig {
  return migrateWidgetConfigByRole(currentConfig, newVisualType);
}
