import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { postCashMovementExpenseJournalEntry } from "@/lib/services/accounting-posting.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions/movements:
 *   get:
 *     tags:
 *       - CashRegister
 *     summary: Listar movimientos y salidas de caja de una sesión
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Registrar una salida de dinero por emergencia o gasto menor con asiento contable
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionIdParam = searchParams.get("sessionId");

    if (!sessionIdParam) {
      return Response.json({ error: "Parámetro sessionId requerido." }, { status: 400 });
    }

    const sessionId = Number.parseInt(sessionIdParam, 10);
    if (Number.isNaN(sessionId)) {
      return Response.json({ error: "sessionId inválido." }, { status: 400 });
    }

    const movements = await (prisma as any).cashMovement.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });

    const formatted = movements.map((m: any) => ({
      id: m.id,
      sessionId: m.sessionId,
      type: m.type,
      amount: Number(m.amount),
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    }));

    return Response.json({ movements: formatted });
  } catch (error: any) {
    console.error("[api/cash-sessions/movements] Error al listar movimientos:", error);
    return Response.json(
      { error: error.message || "Error al consultar movimientos de caja." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sesion = await sesionActual().catch(() => null);
    const body = await request.json().catch(() => ({}));

    const sessionId = Number(body.sessionId);
    const amount = Math.round(Number(body.amount ?? body.monto ?? 0) * 100) / 100;
    const reason = (body.reason ?? body.motivo ?? "").trim();
    const type = body.type === "INCOME" ? "INCOME" : "EXPENSE";

    if (!sessionId || Number.isNaN(sessionId)) {
      return Response.json({ error: "ID de sesión de caja requerido." }, { status: 400 });
    }

    if (amount <= 0) {
      return Response.json(
        { error: "El importe debe ser un monto mayor a S/ 0.00." },
        { status: 400 }
      );
    }

    if (!reason || reason.length < 3) {
      return Response.json(
        { error: "Debe especificar el motivo o justificación de la salida de caja (mínimo 3 caracteres)." },
        { status: 400 }
      );
    }

    // 1. Verificar que la sesión de caja exista y esté abierta
    const cashSession = await (prisma as any).cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: true,
      },
    });

    if (!cashSession) {
      return Response.json({ error: "Sesión de caja no encontrada." }, { status: 404 });
    }

    if (cashSession.status !== "OPEN") {
      return Response.json(
        { error: "No se pueden registrar salidas en una sesión de caja cerrada." },
        { status: 400 }
      );
    }

    // 2. Si es egreso, validar que no exceda el efectivo disponible en caja
    const initialAmount = Number(cashSession.initialAmount) || 0;
    const salesCash = Number(cashSession.salesCash) || 0;
    const previousMovements = cashSession.movements || [];
    const prevExpenses = previousMovements
      .filter((m: any) => m.type === "EXPENSE")
      .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
    const prevIncomes = previousMovements
      .filter((m: any) => m.type === "INCOME")
      .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);

    const currentCashInDrawer = Math.round((initialAmount + salesCash + prevIncomes - prevExpenses) * 100) / 100;

    if (type === "EXPENSE" && amount > currentCashInDrawer) {
      return Response.json(
        {
          error: `No hay suficiente efectivo en caja para retirar S/ ${amount.toFixed(2)}. Saldo actual en gaveta: S/ ${currentCashInDrawer.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // 3. Registrar el movimiento en la base de datos
    const createdMovement = await (prisma as any).cashMovement.create({
      data: {
        sessionId,
        type,
        amount,
        reason: reason.slice(0, 150),
        createdAt: new Date(),
      },
    });

    // 4. Asiento Contable Automático para el Contador
    let journalEntryId: number | null = null;
    try {
      if (type === "EXPENSE") {
        journalEntryId = await postCashMovementExpenseJournalEntry(prisma as any, {
          sessionId,
          amount,
          reason,
          entryDate: createdMovement.createdAt,
          responsible: sesion?.username || "Cajero",
        });
      }
    } catch (journalErr) {
      console.warn("[api/cash-sessions/movements] Asiento contable registrado con advertencia:", journalErr);
    }

    const newCashInDrawer = Math.round((currentCashInDrawer + (type === "INCOME" ? amount : -amount)) * 100) / 100;

    return Response.json(
      {
        message: `Salida de dinero de S/ ${amount.toFixed(2)} registrada y enviada a contabilidad.`,
        journalEntryId,
        movement: {
          id: createdMovement.id,
          sessionId: createdMovement.sessionId,
          type: createdMovement.type,
          amount: Number(createdMovement.amount),
          reason: createdMovement.reason,
          createdAt: createdMovement.createdAt.toISOString(),
        },
        currentCashInDrawer: newCashInDrawer,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/cash-sessions/movements] Error al registrar salida de caja:", error);
    return Response.json(
      { error: error.message || "Error al registrar la salida de caja." },
      { status: 500 }
    );
  }
}
