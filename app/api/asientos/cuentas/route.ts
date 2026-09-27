import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Plan contable disponible para armar las líneas de un asiento manual.
 * Sólo se devuelven cuentas activas, ordenadas por código.
 */
export async function GET() {
  try {
    const cuentas = await prisma.cuenta_contable.findMany({
      where: { activo: true },
      orderBy: { codigo: "asc" },
      select: {
        id_cuenta_contable: true,
        codigo: true,
        nombre: true,
        tipo: true,
      },
    });

    return Response.json({
      data: cuentas.map((cuenta) => ({
        id: cuenta.id_cuenta_contable,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
      })),
    });
  } catch (error) {
    console.error("[api/asientos/cuentas] error al obtener el plan contable:", error);
    return Response.json(
      { error: "No se pudo obtener el plan contable." },
      { status: 500 }
    );
  }
}
