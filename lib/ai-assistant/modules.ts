/**
 * Módulos del ERP que el asistente puede consultar y el permiso que habilita cada uno (SOLO servidor).
 *
 * Refleja `ai-service/knowledge/erp_modules_v1.json` (una prueba lo comprueba). Basta uno de los
 * permisos listados; el rol de sistema (ADMIN) los tiene todos. El proxy firma la lista resultante en
 * la aserción de identidad (`mod`) y `ai-service` solo lee tablas de esos módulos.
 */
import { satisfiesPermission } from "@/lib/auth/permissions-catalog";

export const ASSISTANT_MODULES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ventas: ["pedidos.ver", "ventas.ver", "facturas.ver", "caja.ver", "mesas.ver"],
  productos: ["platos.ver", "inventario.ver"],
  inventario: ["inventario.ver", "transformacion.ver"],
  compras: ["compras.ver", "dashcompras.ver"],
  proveedores: ["proveedores.ver", "compras.ver"],
  caja: ["caja.ver"],
  contabilidad: ["asientos.ver", "cuentas.ver", "periodos.ver", "pagar.ver", "reportes.ver"],
});

export interface ModuleAccess {
  superuser: boolean;
  codes: string[];
}

/** Módulos que el usuario puede consultar según sus permisos vigentes. */
export function allowedModules(access: ModuleAccess): string[] {
  return Object.entries(ASSISTANT_MODULES)
    .filter(([, permissions]) => access.superuser || permissions.some((code) => satisfiesPermission(access.codes, code)))
    .map(([module]) => module);
}
