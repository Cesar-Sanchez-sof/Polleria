import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Filter options available for journal entries list:
 * existing journal books and statuses, with respective counts.
 */
export async function GET() {
  try {
    const [books, statuses] = await Promise.all([
      prisma.journalEntry.groupBy({
        by: ["book"],
        _count: { _all: true },
        orderBy: { book: "asc" },
      }),
      prisma.journalEntry.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const countByStatus = (statusValue: boolean): number =>
      statuses.find((s) => s.status === statusValue)?._count._all ?? 0;

    return Response.json({
      diarios: books.map((b) => ({ nombre: b.book, total: b._count._all })),
      estados: [
        { valor: "registrado", etiqueta: "Registrado", total: countByStatus(true) },
        { valor: "anulado", etiqueta: "Anulado", total: countByStatus(false) },
      ],
    });
  } catch (error) {
    console.error("[api/journal-entries/options] error al obtener opciones:", error);
    return Response.json(
      { error: "No se pudieron obtener las opciones de filtrado." },
      { status: 500 }
    );
  }
}
