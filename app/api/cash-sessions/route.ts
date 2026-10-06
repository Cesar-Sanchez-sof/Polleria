import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/auth/sesion-actual";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/cash-sessions:
 *   get:
 *     tags:
 *       - CashRegister
 *     summary: Obtener estado de la caja y sesión activa
 *   post:
 *     tags:
 *       - CashRegister
 *     summary: Abrir una nueva sesión de caja
 */

export async function GET(_request: NextRequest) {
  try {
    // 1. Asegurar que existe al menos una caja física registrada en el sistema
    let register = await (prisma as any).cashRegister.findFirst({
      where: { active: true },
    }).catch(() => null);

    if (!register) {
      try {
        register = await (prisma as any).cashRegister.create({
          data: {
            name: "Caja Principal - Salón",
            code: "CAJA-01",
            description: "Caja registradora principal del salón",
            active: true,
          },
        });
      } catch {
        // En caso de que la tabla aún no exista
        return Response.json({
          activeSession: null,
          register: null,
          message: "Módulo de caja en preparación o migración pendiente.",
        });
      }
    }

    // 2. Buscar si hay una sesión abierta actualmente
    const activeSession = await (prisma as any).cashSession.findFirst({
      where: {
        cashRegisterId: register.id,
        status: "OPEN",
      },
      include: {
        openedBy: {
          select: { id: true, username: true },
        },
        movements: true,
      },
      orderBy: { id: "desc" },
    }).catch(() => null);

    if (!activeSession) {
      return Response.json({
        activeSession: null,
        register,
        isOpened: false,
      });
    }

    const initialAmount = Number(activeSession.initialAmount) || 0;
    const salesCash = Number(activeSession.salesCash) || 0;
    const salesOther = Number(activeSession.salesOther) || 0;
    const totalSales = Number(activeSession.totalSales) || (salesCash + salesOther);
    const expectedAmount = Math.round((initialAmount + salesCash) * 100) / 100;

    return Response.json({
      isOpened: true,
      register,
      activeSession: {
        id: activeSession.id,
        cashRegisterId: activeSession.cashRegisterId,
        openedAt: activeSession.openedAt.toISOString(),
        openedBy: activeSession.openedBy?.username || "Cajero",
        initialAmount,
        salesCash,
        salesOther,
        totalSales,
        expectedAmount,
        notesOpening: activeSession.notesOpening || "",
        status: activeSession.status,
      },
    });
  } catch (error: any) {
    console.error("[api/cash-sessions] Error al consultar sesión:", error);
    return Response.json(
      { error: "No se pudo obtener el estado de la caja." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sesion = await sesionActual().catch(() => null);
    let userId = sesion?.idUsuario;

    // Verificar si el usuario de la sesión existe realmente en la base de datos
    if (userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) {
        userId = undefined;
      }
    }

    // Si no hay sesión o el id no existe en BD, usar el primer usuario activo registrado
    if (!userId) {
      const fallbackUser =
        (await prisma.user.findFirst({
          where: { estado: true },
          select: { id: true },
        })) ||
        (await prisma.user.findFirst({
          select: { id: true },
        }));
      userId = fallbackUser?.id;
    }

    if (!userId) {
      return Response.json(
        { error: "No se encontró ningún usuario registrado en el sistema para asociar la apertura de caja." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const initialAmount = Math.max(0, Number(body.initialAmount ?? body.montoInicial ?? 0));
    const notesOpening = (body.notesOpening ?? body.observaciones ?? "").trim();

    // 1. Obtener o crear la caja principal
    let register = await (prisma as any).cashRegister.findFirst({
      where: { active: true },
    });

    if (!register) {
      register = await (prisma as any).cashRegister.create({
        data: {
          name: "Caja Principal - Salón",
          code: "CAJA-01",
          description: "Caja registradora principal del salón",
          active: true,
        },
      });
    }

    // 2. Validar que la caja no tenga ya una sesión abierta (Regla: Evitar aperturas múltiples simultáneas)
    const existingOpenSession = await (prisma as any).cashSession.findFirst({
      where: {
        cashRegisterId: register.id,
        status: "OPEN",
      },
    });

    if (existingOpenSession) {
      return Response.json(
        {
          error: `La caja '${register.name}' ya tiene una sesión abierta activa (Sesión #${existingOpenSession.id}). Debe cerrarse antes de iniciar una nueva.`,
        },
        { status: 400 }
      );
    }

    // 3. Crear la nueva sesión de caja
    const newSession = await (prisma as any).cashSession.create({
      data: {
        cashRegisterId: register.id,
        openedById: userId,
        initialAmount,
        salesCash: 0,
        salesOther: 0,
        totalSales: 0,
        status: "OPEN",
        notesOpening: notesOpening || null,
        openedAt: new Date(),
      },
      include: {
        openedBy: {
          select: { id: true, username: true },
        },
      },
    });

    return Response.json(
      {
        message: "Caja abierta exitosamente.",
        session: {
          id: newSession.id,
          cashRegisterId: newSession.cashRegisterId,
          openedAt: newSession.openedAt.toISOString(),
          openedBy: newSession.openedBy?.username || "Cajero",
          initialAmount: Number(newSession.initialAmount),
          status: newSession.status,
          notesOpening: newSession.notesOpening || "",
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/cash-sessions] Error al abrir caja:", error);
    return Response.json(
      { error: error.message || "Error al abrir la caja registradora." },
      { status: 500 }
    );
  }
}
