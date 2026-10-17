import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDateToIso } from "@/lib/dates";
import { authorize } from "@/lib/auth/permissions";

/**
 * @openapi
 * /api/journal-entries/{id}:
 *   get:
 *     tags:
 *       - JournalEntries
 *     summary: Obtener detalle de asiento contable
 *     description: Obtiene el detalle completo de un asiento contable especificado por su identificador.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador del asiento contable.
 *     responses:
 *       200:
 *         description: Detalle del asiento contable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JournalEntryDetail'
 *       400:
 *         description: Identificador inválido.
 *       404:
 *         description: Asiento no encontrado.
 *       500:
 *         description: Error interno del servidor.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("asientos.ver");
  if (!auth.ok) return auth.response;
  try {
    const { id: idParam } = await params;
    const entryId = Number.parseInt(idParam, 10);

    if (Number.isNaN(entryId)) {
      return Response.json({ error: "Identificador de asiento inválido." }, { status: 400 });
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: {
        entryDetails: {
          orderBy: { id: "asc" },
          include: { account: true },
        },
      },
    });

    if (!entry) {
      return Response.json({ error: "Asiento contable no encontrado." }, { status: 404 });
    }

    const lines = entry.entryDetails.map((line) => ({
      id: line.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      description: line.description ?? "",
      debit: Number(line.debit),
      credit: Number(line.credit),
    }));

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    return Response.json({
      id: entry.id,
      number: entry.code,
      date: formatDateToIso(entry.entryDate),
      daily: entry.book,
      concept: entry.description,
      status: entry.status ? "Registrado" : "Anulado",
      responsible: entry.responsible ?? "",
      observation: entry.observation ?? "",
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      total: totalDebit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.005,
      totals: { debit: totalDebit, credit: totalCredit },
      lines: lines,
    });
  } catch (error) {
    console.error("[api/journal-entries/[id]] error al obtener el asiento:", error);
    return Response.json(
      { error: "No se pudo obtener el detalle del asiento contable." },
      { status: 500 }
    );
  }
}
