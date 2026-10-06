import type { NextRequest } from "next/server";
import { parseUtcDate } from "@/lib/dates";
import { generateJournalEntryCode } from "@/lib/journal-entry-code";

/**
 * @openapi
 * /api/journal-entries/next-code:
 *   get:
 *     tags:
 *       - JournalEntries
 *     summary: Obtener código sugerido para nuevo asiento
 *     description: Genera un código preliminar (formato MISC/YYYY/MM/NNNN) para un asiento contable manual basado en la fecha proporcionada.
 *     parameters:
 *       - in: query
 *         name: fecha
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha en formato YYYY-MM-DD para la cual generar el código. Si no se especifica, se usa la fecha actual.
 *     responses:
 *       200:
 *         description: Código sugerido generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codigo:
 *                   type: string
 *                   description: Código sugerido del asiento contable
 *       500:
 *         description: Error interno al generar el código
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Suggests the code (`MISC/YYYY/MM/NNNN`) that a manual journal entry would receive
 * for the specified date. This is only a preview: the definitive code is assigned
 * at the moment of entry creation.
 */
export async function GET(request: NextRequest) {
  try {
    const param = request.nextUrl.searchParams.get("fecha");
    const date = param && DATE_REGEX.test(param) ? parseUtcDate(param) : new Date();

    const code = await generateJournalEntryCode(date);

    return Response.json({ codigo: code });
  } catch (error) {
    console.error("[api/journal-entries/next-code] error al sugerir el número:", error);
    return Response.json(
      { error: "No se pudo obtener el número sugerido del asiento." },
      { status: 500 }
    );
  }
}
