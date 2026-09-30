import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient | typeof prisma;

export async function obtenerOCrearEmpleadoActivo(
  tx: PrismaTx = prisma,
  id_empleado_solicitado?: number
): Promise<number> {
  if (!tx || !tx.empleado) {
    return id_empleado_solicitado || 1;
  }

  // 1. Si se solicita un id_empleado, verificar si existe
  if (id_empleado_solicitado) {
    const empleado = await tx.empleado.findUnique({
      where: { id_empleado: id_empleado_solicitado },
    });
    if (empleado) {
      return empleado.id_empleado;
    }
  }

  // 2. Buscar cualquier empleado activo existente
  const empleadoExistente = await tx.empleado.findFirst({
    where: { estado: true },
    orderBy: { id_empleado: "asc" },
  });

  if (empleadoExistente) {
    return empleadoExistente.id_empleado;
  }

  // 3. Si no existe ningún empleado activo, buscar cualquier empleado
  const cualquierEmpleado = await tx.empleado.findFirst({
    orderBy: { id_empleado: "asc" },
  });

  if (cualquierEmpleado) {
    return cualquierEmpleado.id_empleado;
  }

  // 4. Si no existe ningún empleado en la base de datos, crear uno por defecto
  const nuevoEmpleado = await tx.empleado.upsert({
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

  return nuevoEmpleado.id_empleado;
}
