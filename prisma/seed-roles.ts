import type { PrismaClient } from "@prisma/client";
import { PERMISSIONS_CATALOG, PERMISSION_MODULES, VALID_CODES } from "../lib/auth/permissions-catalog";

/** Arma códigos `modulo.accion` y falla si alguno no existe en el catálogo. */
function p(module: string, ...actions: string[]): string[] {
  return actions.map((a) => {
    const code = `${module}.${a}`;
    if (!VALID_CODES.has(code)) throw new Error(`Permiso inexistente en el catálogo: ${code}`);
    return code;
  });
}

/**
 * Roles base con mínimo privilegio y segregación de funciones (ISO/IEC 27001
 * A.5.3, A.5.15, A.5.18): quien toma pedidos no cobra, quien cobra no registra
 * asientos, quien registra asientos no mueve caja.
 */
const ROLES_BASE: Array<{ name: string; description: string; permissions: string[] }> = [
  {
    name: "CAJERO",
    description: "Cobra ventas, gestiona la caja y los clientes",
    permissions: [
      ...p("ventas", "ver", "crear"),
      ...p("facturas", "ver"),
      ...p("caja", "ver", "crear", "editar"),
      ...p("clientes", "ver", "crear", "editar"),
      ...p("pedidos", "ver"),
    ],
  },
  {
    name: "MESERO",
    description: "Atiende mesas y registra pedidos",
    permissions: [
      ...p("pedidos", "ver", "crear", "editar"),
      ...p("bebidas", "ver"),
      ...p("listos", "ver"),
      ...p("mesas", "ver", "editar"),
      ...p("platos", "ver"),
      ...p("clientes", "ver"),
    ],
  },
  {
    name: "COCINERO",
    description: "Prepara pedidos y transforma insumos",
    permissions: [
      ...p("cocina", "ver", "editar"),
      ...p("pedidos", "ver"),
      ...p("listos", "ver"),
      ...p("platos", "ver"),
      ...p("inventario", "ver"),
      ...p("transformacion", "ver", "crear"),
    ],
  },
  {
    name: "CONTADOR",
    description: "Contabilidad completa; consulta compras, ventas y auditoría",
    permissions: [
      ...p("asientos", "ver", "crear", "editar"),
      ...p("pagar", "ver"),
      ...p("cuentas", "ver", "crear", "editar"),
      ...p("periodos", "ver", "crear", "editar"),
      ...p("comprobacion", "ver"),
      ...p("balance", "ver"),
      ...p("dashboard", "ver"),
      ...p("resultados", "ver"),
      ...p("flujo", "ver"),
      ...p("mayor", "ver"),
      ...p("ple", "ver"),
      ...p("resumen", "ver"),
      ...p("guia", "ver"),
      ...p("dashcompras", "ver"),
      ...p("compras", "ver"),
      ...p("proveedores", "ver"),
      ...p("inventario", "ver"),
      ...p("ventas", "ver"),
      ...p("facturas", "ver"),
      ...p("auditoria", "ver"),
    ],
  },
];

export async function seedRolesPermissions(prisma: PrismaClient) {
  // 1. Sincroniza el catálogo (alta/actualización y baja de códigos obsoletos).
  const known = new Set((await prisma.permission.findMany({ select: { code: true } })).map((x) => x.code));
  for (const permission of PERMISSIONS_CATALOG) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, action: permission.action, name: permission.name },
      create: { ...permission },
    });
  }

  // Pantallas nuevas: los roles que ya podían ver el módulo padre (p. ej. `reportes.ver`)
  // reciben el "ver" de cada pantalla hija recién creada, para no perder acceso.
  const parents = [...new Set(PERMISSION_MODULES.flatMap((m) => (m.parent ? [m.parent] : [])))];
  for (const parent of parents) {
    const created = PERMISSION_MODULES.filter((m) => m.parent === parent)
      .map((m) => `${m.code}.ver`)
      .filter((code) => !known.has(code));
    if (created.length === 0) continue;
    const holders = await prisma.rolePermission.findMany({
      where: { permission: { code: `${parent}.ver` } },
      select: { roleId: true },
    });
    const children = await prisma.permission.findMany({ where: { code: { in: created } }, select: { id: true } });
    await prisma.rolePermission.createMany({
      data: holders.flatMap((h) => children.map((c) => ({ roleId: h.roleId, permissionId: c.id }))),
      skipDuplicates: true,
    });
  }

  await prisma.permission.deleteMany({ where: { code: { notIn: PERMISSIONS_CATALOG.map((c) => c.code) } } });

  const all = await prisma.permission.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(all.map((x) => [x.code, x.id]));

  // 2. ADMIN: rol de sistema con todos los permisos (se re-sincroniza siempre).
  const admin = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { isSystem: true, active: true },
    create: { name: "ADMIN", description: "Administrador del sistema", active: true, isSystem: true },
  });
  await prisma.rolePermission.createMany({
    data: all.map((x) => ({ roleId: admin.id, permissionId: x.id })),
    skipDuplicates: true,
  });

  // 3. Roles base: solo reciben permisos si no tienen ninguno, para no pisar
  //    lo que el administrador haya editado desde la pantalla de roles.
  for (const base of ROLES_BASE) {
    const role = await prisma.role.upsert({
      where: { name: base.name },
      update: {},
      create: { name: base.name, description: base.description, active: true },
    });
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0) {
      await prisma.rolePermission.createMany({
        data: base.permissions.map((c) => ({ roleId: role.id, permissionId: idByCode.get(c)! })),
        skipDuplicates: true,
      });
    }
  }
  console.log("✔ Catálogo de permisos y roles base sincronizados.");
}