/**
 * Catálogo de permisos del sistema (fuente única de verdad).
 * Código de permiso = `modulo.accion`. "ver" da acceso a la ventana; el resto
 * son acciones dentro de ella ("eliminar" incluye anular).
 */
export type Action = "ver" | "crear" | "editar" | "eliminar";

export interface PermissionModule {
  code: string;
  name: string;
  group: string;
  /** Subgrupo del menú lateral (Salón, Cocina, Caja…), solo para ordenar la tabla de roles. */
  subgroup?: string;
  /** Módulo cuyas APIs también aceptan este permiso "ver" (ver `satisfiesPermission`). */
  parent?: string;
  actions: readonly Action[];
}

const CRUD: readonly Action[] = ["ver", "crear", "editar", "eliminar"];
const WITHOUT_DELETE: readonly Action[] = ["ver", "crear", "editar"];

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  // Ventas (una fila por pantalla del menú lateral)
  { code: "pedidos", name: "Salón de mesas", group: "Ventas", subgroup: "Salón", actions: CRUD },
  { code: "bebidas", name: "Despacho de bebidas", group: "Ventas", subgroup: "Salón", parent: "pedidos", actions: ["ver"] },
  { code: "listos", name: "Pedidos listos", group: "Ventas", subgroup: "Salón", parent: "pedidos", actions: ["ver"] },
  { code: "ventas", name: "Pedidos no cobrados", group: "Ventas", subgroup: "Salón", actions: CRUD },
  { code: "cocina", name: "Flujo de cocina (KDS)", group: "Ventas", subgroup: "Cocina", actions: ["ver", "editar"] },
  { code: "platos", name: "Productos y carta", group: "Ventas", subgroup: "Cocina", actions: CRUD },
  { code: "caja", name: "Ventanilla (apertura, cierre, movimientos)", group: "Ventas", subgroup: "Caja", actions: WITHOUT_DELETE },
  { code: "clientes", name: "Clientes", group: "Ventas", subgroup: "Caja", actions: WITHOUT_DELETE },
  { code: "facturas", name: "Facturas de venta", group: "Ventas", subgroup: "Caja", parent: "ventas", actions: ["ver"] },
  // Compras e inventario
  { code: "dashcompras", name: "Dashboard de compras", group: "Compras e inventario", parent: "compras", actions: ["ver"] },
  { code: "compras", name: "Compras", group: "Compras e inventario", actions: CRUD },
  { code: "inventario", name: "Kardex e Inventario", group: "Compras e inventario", actions: WITHOUT_DELETE },
  { code: "transformacion", name: "Transformación de insumos", group: "Compras e inventario", actions: ["ver", "crear", "eliminar"] },
  { code: "proveedores", name: "Proveedores", group: "Compras e inventario", actions: CRUD },
  // Contabilidad
  { code: "asientos", name: "Asientos contables", group: "Contabilidad", subgroup: "Registros", actions: WITHOUT_DELETE },
  { code: "pagar", name: "Cuentas por pagar", group: "Contabilidad", subgroup: "Registros", parent: "asientos", actions: ["ver"] },
  { code: "cuentas", name: "Cuentas contables", group: "Contabilidad", subgroup: "Registros", actions: WITHOUT_DELETE },
  { code: "periodos", name: "Periodos contables", group: "Contabilidad", subgroup: "Registros", actions: WITHOUT_DELETE },
  { code: "comprobacion", name: "Balance de comprobación", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "balance", name: "Balance general", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "dashboard", name: "Dashboard contable", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "resultados", name: "Estado de resultados", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "flujo", name: "Flujo de efectivo", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "mayor", name: "Libro mayor", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "ple", name: "Libros SUNAT (PLE)", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  { code: "resumen", name: "Resumen ejecutivo", group: "Contabilidad", subgroup: "Reportes", parent: "reportes", actions: ["ver"] },
  // Seguridad
  { code: "usuarios", name: "Usuarios", group: "Seguridad", actions: WITHOUT_DELETE },
  { code: "roles", name: "Roles y permisos", group: "Seguridad", actions: CRUD },
  { code: "auditoria", name: "Auditoría", group: "Seguridad", actions: ["ver"] },
  // Configuración
  { code: "configuracion", name: "Comprobantes e impresión", group: "Configuración", actions: ["ver", "editar"] },
  { code: "datos", name: "Datos del restaurante", group: "Configuración", parent: "configuracion", actions: ["ver", "editar"] },
  { code: "guia", name: "Guía contable", group: "Configuración", parent: "reportes", actions: ["ver"] },
  { code: "mesas", name: "Mesas", group: "Configuración", actions: CRUD },
  { code: "areas", name: "Salones y áreas", group: "Configuración", parent: "configuracion", actions: ["ver", "editar"] },
  // Documentación
  { code: "endpoints", name: "Endpoints", group: "Documentación", parent: "documentacion", actions: ["ver"] },
  { code: "diagrama", name: "Diagrama DB", group: "Documentación", parent: "documentacion", actions: ["ver"] },
  { code: "estilos", name: "Guía de estilos", group: "Documentación", parent: "documentacion", actions: ["ver"] },
];

/**
 * Permisos "padre": los usa una API compartida por varias pantallas
 * (p. ej. `reportes.ver` en las APIs de reportes). Quien tenga cualquier
 * permiso "ver" hijo supera esa comprobación en el servidor; el acceso a cada
 * pantalla se decide con el permiso propio de la pantalla.
 */
const CHILDREN_BY_PARENT: ReadonlyMap<string, readonly string[]> = PERMISSION_MODULES.reduce((map, m) => {
  if (m.parent) map.set(m.parent, [...(map.get(m.parent) ?? []), m.code]);
  return map;
}, new Map<string, string[]>());

/** ¿Los permisos `held` cubren `required`? (directo, o "ver" del padre vía una pantalla hija). */
export function satisfiesPermission(held: readonly string[], required: string): boolean {
  if (held.includes(required)) return true;
  const [module, action] = required.split(".");
  if (action !== "ver") return false;
  return (CHILDREN_BY_PARENT.get(module) ?? []).some((child) => held.includes(`${child}.ver`));
}

/** Pantallas hijas (permiso "ver") de cada permiso padre, para migrar roles existentes. */
export function childViewCodes(parent: string): string[] {
  return (CHILDREN_BY_PARENT.get(parent) ?? []).map((c) => `${c}.ver`);
}

export const ACTION_LABEL: Record<Action, string> = {
  ver: "Ver (acceso a la ventana)",
  crear: "Crear / agregar",
  editar: "Editar / actualizar",
  eliminar: "Eliminar / anular",
};

export interface PermissionCatalog {
  code: string;
  module: string;
  action: Action;
  name: string;
}

export const PERMISSIONS_CATALOG: readonly PermissionCatalog[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => ({
    code: `${m.code}.${a}`,
    module: m.code,
    action: a,
    name: `${m.name}: ${ACTION_LABEL[a]}`.slice(0, 100),
  })),
);

export const VALID_CODES: ReadonlySet<string> = new Set(PERMISSIONS_CATALOG.map((p) => p.code));