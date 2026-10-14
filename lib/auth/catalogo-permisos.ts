/**
 * Catálogo de permisos del sistema (fuente única de verdad).
 * Código de permiso = `modulo.accion`. "ver" da acceso a la ventana; el resto
 * son acciones dentro de ella ("eliminar" incluye anular).
 */
export type Accion = "ver" | "crear" | "editar" | "eliminar";

export interface ModuloPermisos {
  codigo: string;
  nombre: string;
  grupo: string;
  acciones: readonly Accion[];
}

const CRUD: readonly Accion[] = ["ver", "crear", "editar", "eliminar"];
const SIN_ELIMINAR: readonly Accion[] = ["ver", "crear", "editar"];

export const MODULOS_PERMISOS: readonly ModuloPermisos[] = [
  // Ventas
  { codigo: "ventas", nombre: "Ventas y comprobantes", grupo: "Ventas", acciones: CRUD },
  { codigo: "caja", nombre: "Caja (apertura, cierre, movimientos)", grupo: "Ventas", acciones: SIN_ELIMINAR },
  { codigo: "clientes", nombre: "Clientes", grupo: "Ventas", acciones: SIN_ELIMINAR },
  // Restaurante
  { codigo: "pedidos", nombre: "Pedidos de mesa", grupo: "Restaurante", acciones: CRUD },
  { codigo: "cocina", nombre: "Cocina", grupo: "Restaurante", acciones: ["ver", "editar"] },
  { codigo: "platos", nombre: "Platos y recetas", grupo: "Restaurante", acciones: CRUD },
  { codigo: "mesas", nombre: "Mesas", grupo: "Restaurante", acciones: CRUD },
  // Compras e inventario
  { codigo: "compras", nombre: "Compras", grupo: "Compras e inventario", acciones: CRUD },
  { codigo: "proveedores", nombre: "Proveedores", grupo: "Compras e inventario", acciones: CRUD },
  { codigo: "inventario", nombre: "Inventario", grupo: "Compras e inventario", acciones: SIN_ELIMINAR },
  { codigo: "transformacion", nombre: "Transformación de insumos", grupo: "Compras e inventario", acciones: ["ver", "crear", "eliminar"] },
  // Contabilidad
  { codigo: "asientos", nombre: "Asientos contables", grupo: "Contabilidad", acciones: SIN_ELIMINAR },
  { codigo: "cuentas", nombre: "Plan de cuentas", grupo: "Contabilidad", acciones: SIN_ELIMINAR },
  { codigo: "periodos", nombre: "Periodos contables", grupo: "Contabilidad", acciones: SIN_ELIMINAR },
  { codigo: "reportes", nombre: "Reportes (mayor, balance, resultados, guía)", grupo: "Contabilidad", acciones: ["ver"] },
  // Seguridad y sistema
  { codigo: "usuarios", nombre: "Usuarios", grupo: "Seguridad", acciones: SIN_ELIMINAR },
  { codigo: "roles", nombre: "Roles y permisos", grupo: "Seguridad", acciones: CRUD },
  { codigo: "auditoria", nombre: "Auditoría", grupo: "Seguridad", acciones: ["ver"] },
  { codigo: "documentacion", nombre: "Documentación técnica (Swagger, diagrama BD)", grupo: "Seguridad", acciones: ["ver"] },
];

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ver: "Ver (acceso a la ventana)",
  crear: "Crear / agregar",
  editar: "Editar / actualizar",
  eliminar: "Eliminar / anular",
};

export interface PermisoCatalogo {
  code: string;
  module: string;
  action: Accion;
  name: string;
}

export const CATALOGO_PERMISOS: readonly PermisoCatalogo[] = MODULOS_PERMISOS.flatMap((m) =>
  m.acciones.map((a) => ({
    code: `${m.codigo}.${a}`,
    module: m.codigo,
    action: a,
    name: `${m.nombre}: ${ETIQUETA_ACCION[a]}`.slice(0, 100),
  })),
);

export const CODIGOS_VALIDOS: ReadonlySet<string> = new Set(CATALOGO_PERMISOS.map((p) => p.code));