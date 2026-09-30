import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDateToIso } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      cuentaCodigo: line.account.code,
      cuentaNombre: line.account.name,
      cuentaTipo: line.account.type,
      descripcion: line.description ?? "",
      debe: Number(line.debit),
      haber: Number(line.credit),
    }));

    const totalDebit = lines.reduce((sum, l) => sum + l.debe, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.haber, 0);

    return Response.json({
      id: entry.id,
      numero: entry.code,
      fecha: formatDateToIso(entry.entryDate),
      diario: entry.book,
      concepto: entry.description,
      estado: entry.status ? "Registrado" : "Anulado",
      responsable: entry.responsible ?? "",
      observacion: entry.observation ?? "",
      fechaCreacion: entry.createdAt.toISOString(),
      fechaActualizacion: entry.updatedAt.toISOString(),
      total: totalDebit,
      cuadrado: Math.abs(totalDebit - totalCredit) < 0.005,
      totales: { debe: totalDebit, haber: totalCredit },
      lineas: lines,
    });
  } catch (error) {
    console.error("[api/asientos/[id]] error al obtener el asiento:", error);
    return Response.json(
      { error: "No se pudo obtener el detalle del asiento contable." },
      { status: 500 }
    );
  }
}
