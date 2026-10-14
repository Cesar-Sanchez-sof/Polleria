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
  actions: readonly Action[];
}

const CRUD: readonly Action[] = ["ver", "crear", "editar", "eliminar"];
const WITHOUT_DELETE: readonly Action[] = ["ver", "crear", "editar"];

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  // Ventas
  { code: "ventas", name: "Ventas y comprobantes", group: "Ventas", actions: CRUD },
  { code: "caja", name: "Caja (apertura, cierre, movimientos)", group: "Ventas", actions: WITHOUT_DELETE },
  { code: "clientes", name: "Clientes", group: "Ventas", actions: WITHOUT_DELETE },
  // Restaurante
  { code: "pedidos", name: "Pedidos de mesa", group: "Restaurante", actions: CRUD },
  { code: "cocina", name: "Cocina", group: "Restaurante", actions: ["ver", "editar"] },
  { code: "platos", name: "Platos y recetas", group: "Restaurante", actions: CRUD },
  { code: "mesas", name: "Mesas", group: "Restaurante", actions: CRUD },
    { code: "configuracion", name: "Configuración del restaurante (salones, datos, impresión)", group: "Restaurante", actions: ["ver", "editar"] },
  // Compras e inventario
  { code: "compras", name: "Compras", group: "Compras e inventario", actions: CRUD },
  { code: "proveedores", name: "Proveedores", group: "Compras e inventario", actions: CRUD },
  { code: "inventario", name: "Inventario", group: "Compras e inventario", actions: WITHOUT_DELETE },
  { code: "transformacion", name: "Transformación de insumos", group: "Compras e inventario", actions: ["ver", "crear", "eliminar"] },
  // Contabilidad
  { code: "asientos", name: "Asientos contables", group: "Contabilidad", actions: WITHOUT_DELETE },
  { code: "cuentas", name: "Plan de cuentas", group: "Contabilidad", actions: WITHOUT_DELETE },
  { code: "periodos", name: "Periodos contables", group: "Contabilidad", actions: WITHOUT_DELETE },
  { code: "reportes", name: "Reportes (mayor, balance, resultados, guía)", group: "Contabilidad", actions: ["ver"] },
  // Seguridad y sistema
  { code: "usuarios", name: "Usuarios", group: "Seguridad", actions: WITHOUT_DELETE },
  { code: "roles", name: "Roles y permisos", group: "Seguridad", actions: CRUD },
  { code: "auditoria", name: "Auditoría", group: "Seguridad", actions: ["ver"] },
  { code: "documentacion", name: "Documentación técnica (Swagger, diagrama BD)", group: "Seguridad", actions: ["ver"] },
];

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