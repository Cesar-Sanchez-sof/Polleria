import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient | typeof prisma;

export async function getOrCreateActiveEmployee(
  tx: PrismaTx = prisma,
  requestedEmployeeId?: number
): Promise<number> {
  if (!tx || !tx.empleado) {
    return requestedEmployeeId || 1;
  }

  // 1. Si se solicita un id_empleado, verificar si existe
  if (requestedEmployeeId) {
    const employee = await tx.empleado.findUnique({
      where: { id_empleado: requestedEmployeeId },
    });
    if (employee) {
      return employee.id_empleado;
    }
  }

  // 2. Buscar cualquier empleado activo existente
  const existingEmployee = await tx.empleado.findFirst({
    where: { estado: true },
    orderBy: { id_empleado: "asc" },
  });

  if (existingEmployee) {
    return existingEmployee.id_empleado;
  }

  // 3. Si no existe ningún empleado activo, buscar cualquier empleado
  const anyEmployee = await tx.empleado.findFirst({
    orderBy: { id_empleado: "asc" },
  });

  if (anyEmployee) {
    return anyEmployee.id_empleado;
  }

  // 4. Si no existe ningún empleado en la base de datos, crear uno por defecto
  const newEmployee = await tx.empleado.upsert({
    where: { dni: "00000000" },
    update: { estado: true },
    create: {
      dni: "00000000",
      primer_nombre: "Administrador",
      apellido_paterno: "Sistema",
      cargo: "Administrador",
      area: "Administración",
      estado: true,
    },
  });

  return newEmployee.id_empleado;
}
