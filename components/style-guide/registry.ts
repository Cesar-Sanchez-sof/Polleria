export interface StyleGuideEntry {
  slug: string;
  title: string;
  description: string;
}

export interface StyleGuideCategory {
  key: string;
  label: string;
  entries: StyleGuideEntry[];
}

/** Navigation of the style guide: categories and their component pages. */
export const STYLE_GUIDE_CATEGORIES: readonly StyleGuideCategory[] = [
  {
    key: "inputs",
    label: "Entradas",
    entries: [
      { slug: "button", title: "AppButton", description: "Botón principal y variantes, con icono, carga y tamaños." },
    ],
  },
  {
    key: "visualization",
    label: "Visualización",
    entries: [
      { slug: "table", title: "Table / DataTable", description: "Tablas de datos con densidad, paginación y estados de carga/vacío." },
      { slug: "tag-cell", title: "TagCell / Tag", description: "Celda con tag y valor (RUC 2060…), con extras." },
      { slug: "row-actions", title: "RowActions", description: "Botones de acción de fila con icono, palabra o ambos." },
      { slug: "primary-cell", title: "PrimaryCell", description: "Celda principal con icono, subtítulo y título clickeable." },
      { slug: "stat-card", title: "StatCard", description: "Tarjeta de indicador con icono, píldora, valor y pie." },
      { slug: "status-badge", title: "Badge de estado", description: "Píldora de estado con punto, tamaños y detalle." },
    ],
  },
  {
    key: "navigation",
    label: "Navegación",
    entries: [
      { slug: "nav-tree", title: "NavTree", description: "Árbol de navegación plegable con iconos, badges y acordeón." },
      { slug: "tabs", title: "Tabs / SegmentedTabs", description: "Pestañas con contador para filtrar por estado." },
    ],
  },
];

export function entryHref(categoryKey: string, slug: string): string {
  return `/style-guide/${categoryKey}/${slug}`;
}
