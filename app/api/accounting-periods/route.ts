import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";
import { actorActual } from "@/lib/auth/actor-auditoria";

export const dynamic = "force-dynamic";

// Define role IDs matching your database role entries
const ADMIN_ROLE_ID = 1; // adjust if ADMIN has a different ID

// Simple role check helper – expects headers "x-user-id" and "x-user-role" set by your auth middleware.
async function requireRole(request: NextRequest, allowedRoles: number[]): Promise<number> {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    throw new Error('Unauthorized: missing authentication token');
  }
  // For this demo, token is a dummy placeholder; map to admin user (id 1)
  const user = await prisma.user.findUnique({ where: { id: 3 } });
  if (!user) {
    throw new Error('Unauthorized: user not found');
  }
  if (!allowedRoles.includes(user.roleId)) {
    throw new Error('Forbidden: insufficient role');
  }
  return user.id;
}

/**
 * GET /api/accounting-periods
 * Returns a list of accounting periods. Accepts optional query parameters:
 *   ?status=open|closed – filter by status
 */
/**
 * @openapi
 * /api/accounting-periods:
 *   get:
 *     tags:
 *       - AccountingPeriods
 *     summary: Listar periodos contables
 *     description: Obtiene una lista de periodos contables, opcionalmente filtrados por estado, mes y año.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, closed]
 *         description: Filtrar por estado del periodo.
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Mes (1-12) para filtrar por rango de fechas.
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Año para filtrar por rango de fechas.
 *     responses:
 *       200:
 *         description: Lista de periodos contables.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AccountingPeriod'
 *       500:
 *         description: Error interno.
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const monthParam = request.nextUrl.searchParams.get("month");
    const yearParam = request.nextUrl.searchParams.get("year");

    const where: Prisma.AccountingPeriodWhereInput = {};
    if (status) {
      if (status === "open") where.status = "OPEN";
      else if (status === "closed") where.status = "CLOSED";
    }
    const month = monthParam ? Number(monthParam) : NaN;
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (!isNaN(month) && month >= 1 && month <= 12) {
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      where.startDate = { gte: startOfMonth, lte: endOfMonth };
    }

    const periods = await prisma.accountingPeriod.findMany({ where });
    return Response.json(periods);
  } catch (error) {
    console.error("[api/accounting-periods] GET error:", error);
    return Response.json({ error: "Error retrieving periods" }, { status: 500 });
  }
}

/**
 * @openapi
 * /api/accounting-periods:
 *   post:
 *     tags:
 *       - AccountingPeriods
 *     summary: Crear nuevo período contable
 *     description: Crea un nuevo período contable especificando mes y año.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               month:
 *                 type: integer
 *               year:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Período creado
 *       400:
 *         description: Error de validación
 *       500:
 *         description: Error del servidor
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization – only ADMIN can create periods
    const userId = await requireRole(request, [ADMIN_ROLE_ID]);

    const body = await request.json();
    const { month, year } = body as { month?: number; year?: number };
    const errors: string[] = [];
    if (typeof month !== 'number' || month < 1 || month > 12) errors.push('El mes debe ser un número entero entre 1 y 12');
    if (typeof year !== 'number' || year < 1970) errors.push('year must be a valid integer');
    if (errors.length) return Response.json({ errors }, { status: 400 });

    // Ensure month and year are defined
    if (month === undefined || year === undefined) {
      return Response.json({ error: 'month and year are required' }, { status: 400 });
    }
    // Compute start and end of the selected month (UTC)
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // last day of month

    // Uniqueness: only one period per month/year
    const existing = await prisma.accountingPeriod.findFirst({
      where: {
        startDate: { gte: start, lte: end },
        endDate: { gte: start, lte: end },
      },
    });
    if (existing) errors.push('Ya existe un período para el mes y año seleccionados');

    if (errors.length) return Response.json({ errors }, { status: 400 });

    const period = await prisma.accountingPeriod.create({
      data: {
        startDate: start,
        endDate: end,
        status: "OPEN",
        userId: userId,
      },
    });
        await registrarAuditoria({
      actor: (await actorActual()) ?? { userId, username: `usuario#${userId}` },
      action: "CREATE",
      module: "Contabilidad",
      entity: "Período contable",
      entityId: period.id,
      description: `Creó el período contable ${month}/${year}`,
      details: { despues: { inicio: start, fin: end, estado: "OPEN" } },
      ipAddress: ipDeSolicitud(request),
    });
    return Response.json(period, { status: 201 });
  } catch (error) {
    console.error("[api/accounting-periods] POST error:", error);
    const msg = error instanceof Error ? error.message : "Error creating period";
    return Response.json({ error: msg }, { status: 500 });
  }
}

/**
 * @openapi
 * /api/accounting-periods:
 *   patch:
 *     tags:
 *       - AccountingPeriods
 *     summary: Cerrar o reabrir un período contable
 *     description: Cierra o reabre un período contable según el cuerpo de la solicitud.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               periodId:
 *                 type: integer
 *               reopen:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Período actualizado
 *       400:
 *         description: Error de validación
 *       404:
 *         description: Período no encontrado
 *       500:
 *         description: Error del servidor
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireRole(request, [ADMIN_ROLE_ID]);
    const body = await request.json();
    const { periodId, reopen } = body as { periodId?: number; reopen?: boolean };
    if (!periodId) {
      return Response.json({ error: "periodId is required" }, { status: 400 });
    }
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) {
      return Response.json({ error: "Period not found" }, { status: 404 });
    }
    if (period.status === "CLOSED" && !reopen) {
      return Response.json({ error: "Period already closed" }, { status: 400 });
    }
    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: reopen ? "OPEN" : "CLOSED",
        closedAt: reopen ? null : new Date(),
        closedById: reopen ? null : userId,
      },
    });
        await registrarAuditoria({
      actor: (await actorActual()) ?? { userId, username: `usuario#${userId}` },
      action: "STATUS_CHANGE",
      module: "Contabilidad",
      entity: "Período contable",
      entityId: periodId,
      description: `${reopen ? "Reabrió" : "Cerró"} el período contable #${periodId}`,
      details: { antes: { estado: period.status }, despues: { estado: updated.status } },
      ipAddress: ipDeSolicitud(request),
    });
    return Response.json(updated);
  } catch (error) {
    console.error("[api/accounting-periods] PATCH error:", error);
    const msg = error instanceof Error ? error.message : "Error closing period";
    return Response.json({ error: msg }, { status: 500 });
  }
}
