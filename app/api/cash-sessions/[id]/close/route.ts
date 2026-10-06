import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/auth/sesion-actual";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions/{id}/close:
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Cerrar y arquear una sesión de caja
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
    const notesClosing = (body.notesClosing ?? body.observaciones ?? "").trim();

    // 1. Obtener la sesión existente
    const existingSession = await (prisma as any).cashSession.findUnique({
      where: { id: sessionId },
      include: {
        cashRegister: true,
        openedBy: { select: { username: true } },
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

    // 2. Calcular montos de arqueo
    const initialAmount = Number(existingSession.initialAmount) || 0;
    const salesCash = Number(existingSession.salesCash) || 0;
    const salesOther = Number(existingSession.salesOther) || 0;
    const totalSales = Number(existingSession.totalSales) || (salesCash + salesOther);

    // Monto esperado en gaveta: Fondo Inicial + Ventas en Efectivo
    const expectedAmount = Math.round((initialAmount + salesCash) * 100) / 100;

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

    return Response.json({
      message: "Cierre y arqueo de caja registrado exitosamente.",
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
        expectedAmount,
        countedAmount,
        difference,
        status: "CLOSED",
        notesClosing,
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
