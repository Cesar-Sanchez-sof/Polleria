/**
 * Single source of truth of the real screens that use each documented component.
 * Add a screen here whenever it starts using a shared component; every guide page shows
 * its list in the "Vistas que lo usan" section, grouped by module.
 */
export type StyleGuideComponent =
  | "table"
  | "tabs"
  | "status-badge"
  | "stat-card"
  | "primary-cell"
  | "tag-cell"
  | "row-actions"
  | "button"
  | "nav-tree";

/** Modules in the order the list shows them (same order as the sidebar). */
export const USAGE_MODULES = ["Ventas", "Compras e inventario", "Contabilidad", "Seguridad", "Configuración", "Documentación"] as const;
export type UsageModule = (typeof USAGE_MODULES)[number];

export interface UsedByView {
  label: string;
  href: string;
  module: UsageModule;
}

// Ventas
const SALES: UsedByView = { label: "Ventas", href: "/sales", module: "Ventas" };
const CUSTOMERS: UsedByView = { label: "Clientes", href: "/sales?tab=customers", module: "Ventas" };
const DISHES: UsedByView = { label: "Platos y carta", href: "/sales/kitchen/dishes", module: "Ventas" };
const DRINKS: UsedByView = { label: "Despacho de bebidas", href: "/sales?tab=drinks", module: "Ventas" };
const READY: UsedByView = { label: "Pedidos listos", href: "/sales?tab=kitchen", module: "Ventas" };
const UNCOLLECTED: UsedByView = { label: "Pedidos no cobrados", href: "/sales?tab=payments", module: "Ventas" };
const INVOICES: UsedByView = { label: "Facturas de venta (resumen diario)", href: "/sales?tab=invoices", module: "Ventas" };
const KDS: UsedByView = { label: "Flujo de cocina (KDS)", href: "/sales/kitchen/kds", module: "Ventas" };

// Compras e inventario
const PURCHASES_DASHBOARD: UsedByView = { label: "Dashboard de compras", href: "/purchases/dashboard", module: "Compras e inventario" };
const PURCHASES: UsedByView = { label: "Compras", href: "/purchases/list", module: "Compras e inventario" };
const INVENTORY: UsedByView = { label: "Inventario / insumos", href: "/purchases/inventory", module: "Compras e inventario" };
const TRANSFORMATION: UsedByView = { label: "Transformación (recetas e historial)", href: "/purchases/transformation", module: "Compras e inventario" };
const SUPPLIERS: UsedByView = { label: "Proveedores", href: "/purchases/suppliers", module: "Compras e inventario" };

// Contabilidad
const ENTRIES: UsedByView = { label: "Asientos contables", href: "/accounting/entries", module: "Contabilidad" };
const PAYABLES: UsedByView = { label: "Cuentas por pagar", href: "/accounting/payables", module: "Contabilidad" };
const PERIODS: UsedByView = { label: "Períodos contables", href: "/accounting/periods", module: "Contabilidad" };
const JOURNAL: UsedByView = { label: "Libro diario", href: "/accounting/journal", module: "Contabilidad" };
const LEDGER: UsedByView = { label: "Libro mayor", href: "/accounting/reports/ledger", module: "Contabilidad" };

// Seguridad
const USERS: UsedByView = { label: "Usuarios", href: "/security/users", module: "Seguridad" };
const ROLES: UsedByView = { label: "Roles y permisos", href: "/security/roles", module: "Seguridad" };
const AUDIT: UsedByView = { label: "Auditoría", href: "/security/audit", module: "Seguridad" };

// Configuración
const AREAS: UsedByView = { label: "Salones y áreas", href: "/settings/areas", module: "Configuración" };

export const COMPONENT_USAGE: Record<StyleGuideComponent, readonly UsedByView[]> = {
  table: [
    CUSTOMERS, DISHES,
    PURCHASES, INVENTORY, TRANSFORMATION, SUPPLIERS,
    ENTRIES, PAYABLES, PERIODS, JOURNAL, LEDGER,
    USERS, ROLES, AUDIT,
  ],
  tabs: [SALES, DRINKS, PURCHASES],
  "status-badge": [DISHES, PURCHASES, TRANSFORMATION, SUPPLIERS, ENTRIES, PAYABLES, PERIODS, JOURNAL, USERS, ROLES],
  "stat-card": [
    INVOICES, READY, UNCOLLECTED, DRINKS, KDS, DISHES,
    PURCHASES_DASHBOARD,
    AREAS,
  ],
  "primary-cell": [CUSTOMERS, DISHES, PURCHASES, TRANSFORMATION, SUPPLIERS, ENTRIES, PAYABLES, LEDGER, USERS],
  "tag-cell": [CUSTOMERS, DISHES, PURCHASES, SUPPLIERS, PAYABLES, JOURNAL, LEDGER, USERS, ROLES],
  "row-actions": [CUSTOMERS, DISHES, PURCHASES, INVENTORY, TRANSFORMATION, SUPPLIERS, PAYABLES, PERIODS, USERS, ROLES, AUDIT],
  button: [],
  "nav-tree": [{ label: "Guía de estilos (menú lateral)", href: "/docs/style-guide", module: "Documentación" }],
};
