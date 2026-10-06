import { prisma } from "@/lib/prisma";

/**
 * @openapi
 * /api/journal-entries/options:
 *   get:
 *     tags:
 *       - JournalEntries
 *     summary: Obtener opciones de filtrado para asientos
 *     description: Obtiene los valores de filtrado disponibles para la lista de asientos contables, incluyendo los libros de diarios y los estados con sus totales.
 *     responses:
 *       200:
 *         description: Opciones de filtrado de asientos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 diarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       nombre:
 *                         type: string
 *                       total:
 *                         type: integer
 *                 estados:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       valor:
 *                         type: string
 *                       etiqueta:
 *                         type: string
 *                       total:
 *                         type: integer
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
