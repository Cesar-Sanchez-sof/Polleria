/**
 * Single source of truth of the real screens that use each documented component.
 * Add a screen here whenever it starts using a shared component; every guide page shows
 * its list in the "Vistas que lo usan" section.
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

export interface UsedByView {
  label: string;
  href: string;
}

const PURCHASES: UsedByView = { label: "Compras", href: "/purchases/list" };
const INVENTORY: UsedByView = { label: "Inventario", href: "/purchases/inventory" };
const ENTRIES: UsedByView = { label: "Asientos contables", href: "/accounting/entries" };
const PAYABLES: UsedByView = { label: "Cuentas por pagar", href: "/accounting/payables" };
const PERIODS: UsedByView = { label: "Períodos contables", href: "/accounting/periods" };
const LEDGER: UsedByView = { label: "Libro mayor", href: "/reports/ledger" };
const USERS: UsedByView = { label: "Usuarios", href: "/users" };
const ROLES: UsedByView = { label: "Roles", href: "/roles" };
const CUSTOMERS: UsedByView = { label: "Clientes (Ventas)", href: "/sales?tab=customers" };

export const COMPONENT_USAGE: Record<StyleGuideComponent, readonly UsedByView[]> = {
  table: [PURCHASES, INVENTORY, ENTRIES, PAYABLES, PERIODS, LEDGER, USERS, ROLES, CUSTOMERS],
  tabs: [
    { label: "Ventas", href: "/sales" },
    { label: "Compras", href: "/purchases/list" },
    { label: "Despacho de bebidas", href: "/sales?tab=drinks" },
  ],
  "status-badge": [PURCHASES, ENTRIES, PAYABLES, PERIODS, USERS, ROLES],
  "stat-card": [
    { label: "Ventas: resumen diario", href: "/sales?tab=invoices" },
    { label: "Ventas: pedidos listos", href: "/sales?tab=kitchen" },
    { label: "Ventas: cobros no realizados", href: "/sales?tab=payments" },
    { label: "Platos", href: "/restaurant/dishes" },
  ],
  "primary-cell": [PURCHASES, ENTRIES, PAYABLES, LEDGER, USERS, CUSTOMERS],
  "tag-cell": [PURCHASES, PAYABLES, LEDGER, USERS, ROLES, CUSTOMERS],
  "row-actions": [PURCHASES, INVENTORY, PAYABLES, PERIODS, USERS, ROLES, CUSTOMERS],
  button: [],
  "nav-tree": [{ label: "Guía de estilos (menú lateral)", href: "/style-guide" }],
};
