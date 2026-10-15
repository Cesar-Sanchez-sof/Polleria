/**
 * Qué permiso exige cada pantalla. Este archivo no importa nada del servidor,
 * así que lo usan tanto el menú lateral como el guardián de rutas del cliente.
 * La protección real está en las APIs (autorizar); esto solo evita mostrar
 * pantallas y enlaces a los que el usuario no tiene acceso.
 */

/** Permisos "ver" cuya presencia (cualquiera) hace visible cada sección del menú. */
export const SECTIONS: Record<string, string[]> = {
  restaurant: ["pedidos.ver", "ventas.ver", "caja.ver", "clientes.ver", "cocina.ver", "platos.ver"],
  sales: ["pedidos.ver", "mesas.ver", "ventas.ver", "caja.ver", "clientes.ver"],
  kitchen: ["cocina.ver", "platos.ver"],
  purchases: ["compras.ver", "inventario.ver", "transformacion.ver", "proveedores.ver"],
  records: ["asientos.ver", "cuentas.ver", "periodos.ver"],
  reports: ["reportes.ver"],
  security: ["usuarios.ver", "roles.ver", "auditoria.ver"],
  settings: ["mesas.ver", "configuracion.ver", "reportes.ver"],
  documentation: ["documentacion.ver"],
};

/** Permiso "ver" de cada enlace del menú, tal cual se escribe en el href. */
const LINK_PERMISSION: Record<string, string> = {
  "/sales?tab=tables": "pedidos.ver",
  "/sales?tab=drinks": "pedidos.ver",
  "/sales?tab=kitchen": "pedidos.ver",
  "/sales?tab=payments": "ventas.ver",
  "/sales?tab=cashier": "caja.ver",
  "/sales?tab=customers": "clientes.ver",
  "/sales?tab=invoices": "ventas.ver",
  "/restaurant/kitchen": "cocina.ver",
  "/restaurant/dishes": "platos.ver",
  "/restaurant/tables": "mesas.ver",
  "/restaurant/areas": "configuracion.ver",
  "/restaurant/settings/business": "configuracion.ver",
  "/restaurant/settings/printers": "configuracion.ver",
  "/purchases/add": "compras.ver",
  "/purchases/list": "compras.ver",
  "/purchases/inventory": "inventario.ver",
  "/purchases/transformation": "transformacion.ver",
  "/purchases/suppliers": "proveedores.ver",
  "/purchases/purchase-without-voucher": "compras.ver",
  "/accounting/entries": "asientos.ver",
  "/accounting/payables": "asientos.ver",
  "/accounting/accounts": "cuentas.ver",
  "/accounting/periods": "periodos.ver",
  "/accounting/guide": "reportes.ver",
  "/reports/dashboard": "reportes.ver",
  "/reports/executive-summary": "reportes.ver",
  "/reports/trial-balance": "reportes.ver",
  "/reports/cash-flow": "reportes.ver",
  "/reports/balance": "reportes.ver",
  "/reports/income-statement": "reportes.ver",
  "/reports/ledger": "reportes.ver",
  "/reports/ple": "reportes.ver",
  "/users": "usuarios.ver",
  "/roles": "roles.ver",
  "/audit": "auditoria.ver",
  "/swagger": "documentacion.ver",
  "/db-diagram": "documentacion.ver",
  "/style-guide": "documentacion.ver",
};

/** Permiso del enlace del menú, o `null` si es libre (p. ej. el inicio). */
export function linkPermission(href: string): string | null {
  return LINK_PERMISSION[href] ?? null;
}

/** Reglas por ruta: basta con tener UNO de los permisos. Gana el prefijo más específico. */
const ROUTE_RULES: Array<{ prefix: string; permissions: string[] }> = [
  { prefix: "/sales", permissions: SECTIONS.sales },
  { prefix: "/restaurant/kitchen", permissions: ["cocina.ver"] },
  { prefix: "/restaurant/dishes", permissions: ["platos.ver"] },
  { prefix: "/restaurant/tables", permissions: ["mesas.ver"] },
  { prefix: "/restaurant/areas", permissions: ["configuracion.ver"] },
  { prefix: "/restaurant/settings", permissions: ["configuracion.ver"] },
  { prefix: "/purchases/inventory", permissions: ["inventario.ver"] },
  { prefix: "/purchases/transformation", permissions: ["transformacion.ver"] },
  { prefix: "/purchases/suppliers", permissions: ["proveedores.ver"] },
  { prefix: "/purchases", permissions: ["compras.ver"] },
  { prefix: "/accounting/entries", permissions: ["asientos.ver"] },
  { prefix: "/accounting/journal", permissions: ["asientos.ver"] },
  { prefix: "/accounting/payables", permissions: ["asientos.ver"] },
  { prefix: "/accounting/accounts", permissions: ["cuentas.ver"] },
  { prefix: "/accounting/periods", permissions: ["periodos.ver"] },
  { prefix: "/accounting", permissions: ["reportes.ver"] },
  { prefix: "/reports", permissions: ["reportes.ver"] },
  { prefix: "/users", permissions: ["usuarios.ver"] },
  { prefix: "/roles", permissions: ["roles.ver"] },
  { prefix: "/audit", permissions: ["auditoria.ver"] },
  { prefix: "/swagger", permissions: ["documentacion.ver"] },
  { prefix: "/db-diagram", permissions: ["documentacion.ver"] },
  { prefix: "/style-guide", permissions: ["documentacion.ver"] },
].sort((a, b) => b.prefix.length - a.prefix.length);

/** Permisos que abren esta ruta (cualquiera de ellos), o `null` si cualquier usuario con sesión puede entrar. */
export function requiredPermissions(pathname: string | null): string[] | null {
  if (!pathname) return null;
  const rule = ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return rule ? rule.permissions : null;
}