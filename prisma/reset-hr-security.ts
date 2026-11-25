/**
 * Limpia SOLO los datos de RR. HH. y Seguridad, sin tocar ventas, compras, inventario ni contabilidad
 * del negocio. Pensado para dejar esos dos módulos listos para volver a sembrarse.
 *
 * Borra:
 *  - Planillas (y sus asientos contables), contratos, horarios/turnos, asistencia, vacaciones,
 *    seguros y adelantos.
 *  - Todos los empleados y usuarios EXCEPTO el administrador (`admin`).
 *  - Los roles que no pertenecen al conjunto base y los permisos de los roles base (el seed los
 *    vuelve a asignar según su definición actual).
 * Conserva: el usuario admin y su empleado, el rol ADMIN, el historial de auditoría, y todo el
 * negocio.
 *
 * Uso: npx tsx prisma/reset-hr-security.ts --yes
 * Todo ocurre en una sola transacción: si algo falla (p. ej. un usuario a borrar tiene ventas o
 * tableros asociados), no se borra nada.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const BASE_ROLES = ["ADMIN", "CAJERO", "MESERO", "COCINERO", "CONTADOR", "RRHH", "GERENTE", "EMPLEADO"];

function target(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(DATABASE_URL no definida)";
  }
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Este comando borra datos de RR. HH. y Seguridad. Vuelve a ejecutarlo con --yes para confirmar.");
    process.exitCode = 1;
    return;
  }
  console.log(`Limpiando RR. HH. y Seguridad en: ${target()}`);

  const admin = await prisma.user.findUnique({ where: { username: "admin" }, select: { id: true, employeeId: true } });
  if (!admin) throw new Error("No existe el usuario «admin»: ejecuta primero `npm run db:seed`.");

  const result = await prisma.$transaction(
    async (tx) => {
      // Asientos de planilla: referencian a la planilla con Restrict, hay que quitarlos antes.
      const entries = await tx.journalEntry.deleteMany({ where: { OR: [{ payrollId: { not: null } }, { payrollPeriodId: { not: null } }] } });
      const periods = await tx.payrollPeriod.deleteMany({});
      const payrolls = await tx.payroll.deleteMany({});
      const shifts = await tx.shift.deleteMany({});
      // Al borrar empleados caen en cascada sus contratos, asistencia, licencias, seguros, adelantos y usuarios.
      const employees = await tx.employee.deleteMany({ where: { id: { not: admin.employeeId } } });
      const users = await tx.user.deleteMany({ where: { id: { not: admin.id } } });
      // Los turnos base los usan los contratos (ya borrados con sus empleados).
      const templates = await tx.shiftTemplate.deleteMany({});
      // Roles: fuera los que no son base; los base conservan su fila y pierden permisos (se re-asignan en el seed).
      const roles = await tx.role.deleteMany({ where: { name: { notIn: BASE_ROLES } } });
      const perms = await tx.rolePermission.deleteMany({ where: { role: { isSystem: false } } });
      return { entries: entries.count, periods: periods.count, payrolls: payrolls.count, shifts: shifts.count, templates: templates.count, employees: employees.count, users: users.count, roles: roles.count, perms: perms.count };
    },
    { maxWait: 20000, timeout: 120000 },
  );

  console.log("✔ Limpieza completada:", result);
  console.log("  Ahora ejecuta: npm run db:seed && npm run db:seed:hr -- --with-payroll");
}

main()
  .catch((e) => {
    console.error("❌ No se borró nada:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
