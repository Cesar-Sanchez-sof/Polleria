import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient | typeof prisma;

export async function getOrCreateActiveEmployee(
  tx: PrismaTx = prisma,
  requestedEmployeeId?: number
): Promise<number> {
  if (!tx || !tx.employee) {
    return requestedEmployeeId || 1;
  }

  // 1. Si se solicita un employeeId, verificar si existe
  if (requestedEmployeeId) {
    const employee = await tx.employee.findUnique({
      where: { id: requestedEmployeeId },
    });
    if (employee) {
      return employee.id;
    }
  }

  // 2. Buscar cualquier empleado activo existente
  const existingEmployee = await tx.employee.findFirst({
    where: { active: true },
    orderBy: { id: "asc" },
  });

  if (existingEmployee) {
    return existingEmployee.id;
  }

  // 3. Si no existe ningún empleado activo, buscar cualquier empleado
  const anyEmployee = await tx.employee.findFirst({
    orderBy: { id: "asc" },
  });

  if (anyEmployee) {
    return anyEmployee.id;
  }

  // 4. Si no existe ningún empleado en la base de datos, crear uno por defecto
  const newEmployee = await tx.employee.upsert({
    where: { dni: "00000000" },
    update: { active: true },
    create: {
      dni: "00000000",
      firstName: "Administrador",
      paternalLastName: "Sistema",
      position: "Administrador",
      area: "Administración",
      active: true,
    },
  });

  return newEmployee.id;
}
