import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Opciones disponibles para los filtros del listado de asientos:
 * los diarios contables existentes y los estados posibles, con sus conteos.
 */
export async function GET() {
  try {
    const [diarios, estados] = await Promise.all([
      prisma.asiento_contable.groupBy({
        by: ["diario"],
        _count: { _all: true },
        orderBy: { diario: "asc" },
      }),
      prisma.asiento_contable.groupBy({
        by: ["estado"],
        _count: { _all: true },
      }),
    ]);

    const conteoPorEstado = (estado: boolean): number =>
      estados.find((e) => e.estado === estado)?._count._all ?? 0;

    return Response.json({
      diarios: diarios.map((d) => ({ nombre: d.diario, total: d._count._all })),
      estados: [
        { valor: "registrado", etiqueta: "Registrado", total: conteoPorEstado(true) },
        { valor: "anulado", etiqueta: "Anulado", total: conteoPorEstado(false) },
      ],
    });
  } catch (error) {
    console.error("[api/asientos/opciones] error al obtener opciones:", error);
    return Response.json(
      { error: "No se pudieron obtener las opciones de filtrado." },
      { status: 500 }
    );
  }
}
