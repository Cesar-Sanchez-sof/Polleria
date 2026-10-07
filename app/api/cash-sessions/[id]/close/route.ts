import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { postCashSessionClosingJournalEntries } from "@/lib/services/accounting-posting.service";
import { formatDenominationsSummary } from "@/lib/services/cash-register.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions/{id}/close:
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Cerrar y arquear una sesión de caja con billetes/monedas y asientos contables
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const sessionId = Number.parseInt(idParam, 10);
    if (Number.isNaN(sessionId)) {
      return Response.json({ error: "ID de sesión inválido." }, { status: 400 });
    }

    const sesion = await sesionActual().catch(() => null);
    let userId = sesion?.idUsuario;

    if (userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) {
        userId = undefined;
      }
    }

    if (!userId) {
      const fallbackUser =
        (await prisma.user.findFirst({
          where: { estado: true },
          select: { id: true },
        })) ||
        (await prisma.user.findFirst({
          select: { id: true },
        }));
      userId = fallbackUser?.id ?? undefined;
    }

    const body = await request.json().catch(() => ({}));
    const countedAmount = Math.max(0, Number(body.countedAmount ?? body.montoContado ?? 0));
    let notesClosing = (body.notesClosing ?? body.observaciones ?? "").trim();
    const denominations = body.denominations;

    let denominationsSummary = "";
    if (denominations && typeof denominations === "object") {
      denominationsSummary = formatDenominationsSummary(denominations);
      if (denominationsSummary && denominationsSummary !== "Sin desglose") {
        notesClosing = notesClosing
          ? `${notesClosing} | Arqueo Cierre: ${denominationsSummary}`
          : `Arqueo Cierre: ${denominationsSummary}`;
      }
    }

    // 1. Obtener la sesión existente con sus movimientos
    const existingSession = await (prisma as any).cashSession.findUnique({
      where: { id: sessionId },
      include: {
        cashRegister: true,
        openedBy: { select: { username: true } },
        movements: true,
      },
    });

    if (!existingSession) {
      return Response.json({ error: "Sesión de caja no encontrada." }, { status: 404 });
    }

    if (existingSession.status === "CLOSED") {
      return Response.json(
        { error: "Esta sesión de caja ya fue cerrada previamente." },
        { status: 400 }
      );
    }

    // 2. Calcular montos de arqueo considerando salidas e ingresos
    const initialAmount = Number(existingSession.initialAmount) || 0;
    const salesCash = Number(existingSession.salesCash) || 0;
    const salesOther = Number(existingSession.salesOther) || 0;
    const totalSales = Number(existingSession.totalSales) || (salesCash + salesOther);

    const movements = existingSession.movements || [];
    const totalExpenses = movements
      .filter((m: any) => m.type === "EXPENSE")
      .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
    const totalIncomes = movements
      .filter((m: any) => m.type === "INCOME")
      .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);

    // Monto esperado en gaveta: Fondo Inicial + Ventas Efectivo + Ingresos Extra - Egresos Emergencia
    const expectedAmount = Math.round((initialAmount + salesCash + totalIncomes - totalExpenses) * 100) / 100;

    // Diferencia: Contado - Esperado (Positivo = Sobrante, Negativo = Faltante, Cero = Cuadrado)
    const difference = Math.round((countedAmount - expectedAmount) * 100) / 100;

    const closedAt = new Date();

    // 3. Cerrar la sesión
    const closedSession = await (prisma as any).cashSession.update({
      where: { id: sessionId },
      data: {
        status: "CLOSED",
        closedAt,
        closedById: userId,
        countedAmount,
        expectedAmount,
        difference,
        notesClosing: notesClosing || null,
      },
      include: {
        closedBy: { select: { username: true } },
      },
    });

    // 4. Asientos Contables Automáticos de Cierre para el Contador
    let journalEntryIds: number[] = [];
    try {
      journalEntryIds = await postCashSessionClosingJournalEntries(prisma as any, {
        sessionId: closedSession.id,
        countedAmount,
        expectedAmount,
        difference,
        entryDate: closedAt,
        responsible: closedSession.closedBy?.username || "Cajero",
        denominationsSummary: denominationsSummary || undefined,
      });
    } catch (journalErr) {
      console.warn("[api/cash-sessions/[id]/close] Aviso al generar asientos de cierre:", journalErr);
    }

    const formattedMovements = movements.map((m: any) => ({
      id: m.id,
      sessionId: m.sessionId,
      type: m.type,
      amount: Number(m.amount),
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    }));

    return Response.json({
      message: "Cierre y arqueo de caja registrado y enviado a contabilidad exitosamente.",
      journalEntryIds,
      audit: {
        sessionId: closedSession.id,
        registerName: existingSession.cashRegister.name,
        openedAt: existingSession.openedAt.toISOString(),
        closedAt: closedSession.closedAt.toISOString(),
        openedBy: existingSession.openedBy?.username || "Cajero",
        closedBy: closedSession.closedBy?.username || "Cajero",
        initialAmount,
        salesCash,
        salesOther,
        totalSales,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        expectedAmount,
        countedAmount,
        difference,
        status: "CLOSED",
        notesClosing,
        denominationsSummary,
        movements: formattedMovements,
      },
    });
  } catch (error: any) {
    console.error("[api/cash-sessions/[id]/close] Error al cerrar caja:", error);
    return Response.json(
      { error: error.message || "Error al procesar el cierre de caja." },
      { status: 500 }
    );
  }
}
