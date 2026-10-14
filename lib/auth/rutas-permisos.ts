/**
 * Qué permiso exige cada pantalla. Este archivo no importa nada del servidor,
 * así que lo usan tanto el menú lateral como el guardián de rutas del cliente.
 * La protección real está en las APIs (autorizar); esto solo evita mostrar
 * pantallas y enlaces a los que el usuario no tiene acceso.
 */

/** Permisos "ver" cuya presencia (cualquiera) hace visible cada sección del menú. */
export const SECCIONES: Record<string, string[]> = {
  ventas: ["pedidos.ver", "mesas.ver", "ventas.ver", "caja.ver", "clientes.ver"],
  cocina: ["cocina.ver", "platos.ver", "mesas.ver"],
  compras: ["compras.ver", "inventario.ver", "transformacion.ver", "proveedores.ver"],
  registros: ["asientos.ver", "cuentas.ver", "periodos.ver", "reportes.ver"],
  reportes: ["reportes.ver"],
  seguridad: ["usuarios.ver", "roles.ver", "auditoria.ver"],
  configuracion: ["mesas.ver", "configuracion.ver"],
  documentacion: ["documentacion.ver"],
};

/** Permiso "ver" de cada enlace del menú, tal cual se escribe en el href. */
const PERMISO_DE_ENLACE: Record<string, string> = {
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
  "/purchases": "compras.ver",
  "/purchases/add": "compras.ver",
  "/purchases/list": "compras.ver",
  "/purchases/inventory": "inventario.ver",
  "/purchases/transformation": "transformacion.ver",
  "/purchases/suppliers": "proveedores.ver",
  "/purchases/purchase-without-voucher": "compras.ver",
  "/accounting/entries": "asientos.ver",
  "/accounting/entries?journal=Caja%20y%20bancos": "asientos.ver",
  "/accounting/payables": "asientos.ver",
  "/accounting/accounts": "cuentas.ver",
  "/accounting/periods": "periodos.ver",
  "/accounting/guide": "reportes.ver",
  "/accounting/dashboard": "reportes.ver",
  "/accounting/executive-summary": "reportes.ver",
  "/accounting/trial-balance": "reportes.ver",
  "/accounting/cash-flow": "reportes.ver",
  "/accounting/balance": "reportes.ver",
  "/accounting/income-statement": "reportes.ver",
  "/accounting/ledger": "reportes.ver",
  "/usuarios": "usuarios.ver",
  "/roles": "roles.ver",
  "/audit": "auditoria.ver",
  "/swagger": "documentacion.ver",
  "/db-diagram": "documentacion.ver",
};

/** Permiso del enlace del menú, o `null` si es libre (p. ej. el inicio). */
export function permisoDeEnlace(href: string): string | null {
  return PERMISO_DE_ENLACE[href] ?? null;
}

/** Reglas por ruta: basta con tener UNO de los permisos. Gana el prefijo más específico. */
const REGLAS_RUTA: Array<{ prefijo: string; permisos: string[] }> = [
  { prefijo: "/sales", permisos: SECCIONES.ventas },
  { prefijo: "/restaurant/kitchen", permisos: ["cocina.ver"] },
  { prefijo: "/restaurant/dishes", permisos: ["platos.ver"] },
  { prefijo: "/restaurant/tables", permisos: ["mesas.ver"] },
  { prefijo: "/restaurant/areas", permisos: ["configuracion.ver"] },
  { prefijo: "/restaurant/settings", permisos: ["configuracion.ver"] },
  { prefijo: "/purchases/inventory", permisos: ["inventario.ver"] },
  { prefijo: "/purchases/transformation", permisos: ["transformacion.ver"] },
  { prefijo: "/purchases/suppliers", permisos: ["proveedores.ver"] },
  { prefijo: "/purchases", permisos: ["compras.ver"] },
  { prefijo: "/accounting/entries", permisos: ["asientos.ver"] },
  { prefijo: "/accounting/journal", permisos: ["asientos.ver"] },
  { prefijo: "/accounting/payables", permisos: ["asientos.ver"] },
  { prefijo: "/accounting/accounts", permisos: ["cuentas.ver"] },
  { prefijo: "/accounting/periods", permisos: ["periodos.ver"] },
  { prefijo: "/accounting", permisos: ["reportes.ver"] },
  { prefijo: "/usuarios", permisos: ["usuarios.ver"] },
  { prefijo: "/roles", permisos: ["roles.ver"] },
  { prefijo: "/audit", permisos: ["auditoria.ver"] },
  { prefijo: "/swagger", permisos: ["documentacion.ver"] },
  { prefijo: "/db-diagram", permisos: ["documentacion.ver"] },
].sort((a, b) => b.prefijo.length - a.prefijo.length);

/** Permisos que abren esta ruta (cualquiera de ellos), o `null` si cualquier usuario con sesión puede entrar. */
export function permisosRequeridos(pathname: string | null): string[] | null {
  if (!pathname) return null;
  const regla = REGLAS_RUTA.find((r) => pathname === r.prefijo || pathname.startsWith(r.prefijo + "/"));
  return regla ? regla.permisos : null;
}