/**
 * Qué permiso exige cada pantalla. Este archivo no importa nada del servidor,
 * así que lo usan tanto el menú lateral como el guardián de rutas del cliente.
 * La protección real está en las APIs (autorizar); esto solo evita mostrar
 * pantallas y enlaces a los que el usuario no tiene acceso.
 */

const SALES_VIEWS = ["pedidos.ver", "bebidas.ver", "listos.ver", "ventas.ver", "caja.ver", "clientes.ver", "facturas.ver"];
const RECORD_VIEWS = ["asientos.ver", "pagar.ver", "cuentas.ver", "periodos.ver"];
const REPORT_VIEWS = [
  "comprobacion.ver", "balance.ver", "dashboard.ver", "resultados.ver", "flujo.ver", "mayor.ver", "ple.ver", "resumen.ver",
];
const DOC_VIEWS = ["endpoints.ver", "diagrama.ver", "estilos.ver"];

/** Permisos "ver" cuya presencia (cualquiera) hace visible cada sección del menú. */
export const SECTIONS: Record<string, string[]> = {
  restaurant: [...SALES_VIEWS, "cocina.ver", "platos.ver"],
  sales: ["mesas.ver", ...SALES_VIEWS],
  kitchen: ["cocina.ver", "platos.ver"],
  purchases: ["dashcompras.ver", "compras.ver", "inventario.ver", "transformacion.ver", "proveedores.ver"],
  records: RECORD_VIEWS,
  reports: REPORT_VIEWS,
  accounting: [...RECORD_VIEWS, ...REPORT_VIEWS],
  hr: ["empleados.ver", "horarios.ver"],
  security: ["usuarios.ver", "roles.ver", "auditoria.ver"],
  settings: ["mesas.ver", "configuracion.ver", "datos.ver", "areas.ver", "guia.ver"],
  documentation: DOC_VIEWS,
};

/** Permiso "ver" de cada enlace del menú, tal cual se escribe en el href. */
const LINK_PERMISSION: Record<string, string> = {
  "/hr/employees": "empleados.ver",
  "/hr/schedules": "horarios.ver",
  "/sales?tab=tables": "pedidos.ver",
  "/sales?tab=drinks": "bebidas.ver",
  "/sales?tab=kitchen": "listos.ver",
  "/sales?tab=payments": "ventas.ver",
  "/sales?tab=cashier": "caja.ver",
  "/sales?tab=customers": "clientes.ver",
  "/sales?tab=invoices": "facturas.ver",
  "/sales/kitchen/kds": "cocina.ver",
  "/sales/kitchen/products": "platos.ver",
  "/settings/tables": "mesas.ver",
  "/settings/areas": "areas.ver",
  "/settings/business": "datos.ver",
  "/settings/printers": "configuracion.ver",
  "/purchases/dashboard": "dashcompras.ver",
  "/purchases/add": "compras.ver",
  "/purchases/list": "compras.ver",
  "/purchases/inventory": "inventario.ver",
  "/purchases/transformation": "transformacion.ver",
  "/purchases/suppliers": "proveedores.ver",
  "/purchases/purchase-without-voucher": "compras.ver",
  "/accounting/entries": "asientos.ver",
  "/accounting/payables": "pagar.ver",
  "/accounting/accounts": "cuentas.ver",
  "/accounting/periods": "periodos.ver",
  "/settings/accounting-guide": "guia.ver",
  "/accounting/reports/dashboard": "dashboard.ver",
  "/accounting/reports/executive-summary": "resumen.ver",
  "/accounting/reports/trial-balance": "comprobacion.ver",
  "/accounting/reports/cash-flow": "flujo.ver",
  "/accounting/reports/balance": "balance.ver",
  "/accounting/reports/income-statement": "resultados.ver",
  "/accounting/reports/ledger": "mayor.ver",
  "/accounting/reports/ple": "ple.ver",
  "/security/users": "usuarios.ver",
  "/security/roles": "roles.ver",
  "/security/audit": "auditoria.ver",
  "/docs/swagger": "endpoints.ver",
  "/docs/db-diagram": "diagrama.ver",
  "/docs/style-guide": "estilos.ver",
};

/** Permiso del enlace del menú, o `null` si es libre (p. ej. el inicio). */
export function linkPermission(href: string): string | null {
  return LINK_PERMISSION[href] ?? null;
}

/** Reglas por ruta: basta con tener UNO de los permisos. Gana el prefijo más específico. */
const ROUTE_RULES: Array<{ prefix: string; permissions: string[] }> = [
  { prefix: "/sales", permissions: SECTIONS.sales },
  { prefix: "/sales/kitchen/kds", permissions: ["cocina.ver"] },
  { prefix: "/sales/kitchen/products", permissions: ["platos.ver"] },
  { prefix: "/settings/tables", permissions: ["mesas.ver"] },
  { prefix: "/settings/areas", permissions: ["areas.ver"] },
  { prefix: "/settings/business", permissions: ["datos.ver"] },
  { prefix: "/settings/printers", permissions: ["configuracion.ver"] },
  { prefix: "/purchases/dashboard", permissions: ["dashcompras.ver"] },
  { prefix: "/purchases/inventory", permissions: ["inventario.ver"] },
  { prefix: "/purchases/transformation", permissions: ["transformacion.ver"] },
  { prefix: "/purchases/suppliers", permissions: ["proveedores.ver"] },
  { prefix: "/purchases", permissions: ["compras.ver"] },
  { prefix: "/accounting/entries", permissions: ["asientos.ver"] },
  { prefix: "/accounting/journal", permissions: ["asientos.ver"] },
  { prefix: "/accounting/payables", permissions: ["pagar.ver"] },
  { prefix: "/accounting/accounts", permissions: ["cuentas.ver"] },
  { prefix: "/accounting/periods", permissions: ["periodos.ver"] },
  { prefix: "/settings/accounting-guide", permissions: ["guia.ver"] },
  { prefix: "/accounting/reports", permissions: REPORT_VIEWS },
  { prefix: "/accounting/reports/dashboard", permissions: ["dashboard.ver"] },
  { prefix: "/accounting/reports/executive-summary", permissions: ["resumen.ver"] },
  { prefix: "/accounting/reports/trial-balance", permissions: ["comprobacion.ver"] },
  { prefix: "/accounting/reports/cash-flow", permissions: ["flujo.ver"] },
  { prefix: "/accounting/reports/balance", permissions: ["balance.ver"] },
  { prefix: "/accounting/reports/income-statement", permissions: ["resultados.ver"] },
  { prefix: "/accounting/reports/ledger", permissions: ["mayor.ver"] },
  { prefix: "/accounting/reports/ple", permissions: ["ple.ver"] },
  { prefix: "/accounting", permissions: [...RECORD_VIEWS, ...REPORT_VIEWS] },
  { prefix: "/settings", permissions: SECTIONS.settings },
  { prefix: "/hr/employees", permissions: ["empleados.ver"] },
  { prefix: "/hr/schedules", permissions: ["horarios.ver"] },
  { prefix: "/security/users", permissions: ["usuarios.ver"] },
  { prefix: "/security/roles", permissions: ["roles.ver"] },
  { prefix: "/security/audit", permissions: ["auditoria.ver"] },
  { prefix: "/docs/swagger", permissions: ["endpoints.ver"] },
  { prefix: "/docs/db-diagram", permissions: ["diagrama.ver"] },
  { prefix: "/docs/style-guide", permissions: ["estilos.ver"] },
].sort((a, b) => b.prefix.length - a.prefix.length);

/** Permisos que abren esta ruta (cualquiera de ellos), o `null` si cualquier usuario con sesión puede entrar. */
export function requiredPermissions(pathname: string | null): string[] | null {
  if (!pathname) return null;
  const rule = ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return rule ? rule.permissions : null;
}