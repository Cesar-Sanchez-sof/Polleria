import type { PrismaClient } from "@prisma/client";
import { CATALOGO_PERMISOS, CODIGOS_VALIDOS } from "../lib/auth/catalogo-permisos";

/** Arma códigos `modulo.accion` y falla si alguno no existe en el catálogo. */
function p(modulo: string, ...acciones: string[]): string[] {
  return acciones.map((a) => {
    const codigo = `${modulo}.${a}`;
    if (!CODIGOS_VALIDOS.has(codigo)) throw new Error(`Permiso inexistente en el catálogo: ${codigo}`);
    return codigo;
  });
}

/**
 * Roles base con mínimo privilegio y segregación de funciones (ISO/IEC 27001
 * A.5.3, A.5.15, A.5.18): quien toma pedidos no cobra, quien cobra no registra
 * asientos, quien registra asientos no mueve caja.
 */
const ROLES_BASE: Array<{ name: string; description: string; permisos: string[] }> = [
  {
    name: "CAJERO",
    description: "Cobra ventas, gestiona la caja y los clientes",
    permisos: [
      ...p("ventas", "ver", "crear"),
      ...p("caja", "ver", "crear", "editar"),
      ...p("clientes", "ver", "crear", "editar"),
      ...p("pedidos", "ver"),
      ...p("mesas", "ver"),
    ],
  },
  {
    name: "MESERO",
    description: "Atiende mesas y registra pedidos",
    permisos: [
      ...p("pedidos", "ver", "crear", "editar"),
      ...p("mesas", "ver", "editar"),
      ...p("platos", "ver"),
      ...p("clientes", "ver"),
    ],
  },
  {
    name: "COCINERO",
    description: "Prepara pedidos y transforma insumos",
    permisos: [
      ...p("cocina", "ver", "editar"),
      ...p("pedidos", "ver"),
      ...p("platos", "ver"),
      ...p("inventario", "ver"),
      ...p("transformacion", "ver", "crear"),
    ],
  },
  {
    name: "CONTADOR",
    description: "Contabilidad completa; consulta compras, ventas y auditoría",
    permisos: [
      ...p("asientos", "ver", "crear", "editar"),
      ...p("cuentas", "ver", "crear", "editar"),
      ...p("periodos", "ver", "crear", "editar"),
      ...p("reportes", "ver"),
      ...p("compras", "ver"),
      ...p("proveedores", "ver"),
      ...p("inventario", "ver"),
      ...p("ventas", "ver"),
      ...p("auditoria", "ver"),
    ],
  },
];

export async function seedRolesPermisos(prisma: PrismaClient) {
  // 1. Sincroniza el catálogo (alta/actualización y baja de códigos obsoletos).
  for (const perm of CATALOGO_PERMISOS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, action: perm.action, name: perm.name },
      create: { ...perm },
    });
  }
  await prisma.permission.deleteMany({ where: { code: { notIn: CATALOGO_PERMISOS.map((c) => c.code) } } });

  const todos = await prisma.permission.findMany({ select: { id: true, code: true } });
  const idPorCodigo = new Map(todos.map((x) => [x.code, x.id]));

  // 2. ADMIN: rol de sistema con todos los permisos (se re-sincroniza siempre).
  const admin = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { isSystem: true, active: true },
    create: { name: "ADMIN", description: "Administrador del sistema", active: true, isSystem: true },
  });
  await prisma.rolePermission.createMany({
    data: todos.map((x) => ({ roleId: admin.id, permissionId: x.id })),
    skipDuplicates: true,
  });

  // 3. Roles base: solo reciben permisos si no tienen ninguno, para no pisar
  //    lo que el administrador haya editado desde la pantalla de roles.
  for (const base of ROLES_BASE) {
    const rol = await prisma.role.upsert({
      where: { name: base.name },
      update: {},
      create: { name: base.name, description: base.description, active: true },
    });
    const existentes = await prisma.rolePermission.count({ where: { roleId: rol.id } });
    if (existentes === 0) {
      await prisma.rolePermission.createMany({
        data: base.permisos.map((c) => ({ roleId: rol.id, permissionId: idPorCodigo.get(c)! })),
        skipDuplicates: true,
      });
    }
  }
  console.log("✔ Catálogo de permisos y roles base sincronizados.");
}