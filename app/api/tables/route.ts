import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/tables:
 *   get:
 *     tags:
 *       - Tables
 *     summary: Listar mesas del salón
 *   post:
 *     tags:
 *       - Tables
 *     summary: Registrar una nueva mesa en el salón
 */

const CLOSED_STATUSES = ["Closed", "Cancelled"];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const tablesDb = await prisma.diningTable.findMany({
      where: includeInactive
        ? undefined
        : {
            OR: [
              { active: true },
              { orders: { some: { order: { status: { notIn: CLOSED_STATUSES } } } } },
            ],
          },
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: {
            order: {
              status: { notIn: CLOSED_STATUSES },
            },
          },
          include: {
            order: {
              include: {
                items: {
                  include: { dish: true },
                  orderBy: { id: "asc" },
                },
              },
            },
          },
        },
      },
    });

    const tables = tablesDb.map((m) => {
      const activeTableOrder = m.orders[0] ?? null;
      const order = activeTableOrder?.order ?? null;

      let activeOrder = null;
      if (order) {
        const items = order.items.map((d) => ({
          id: d.id,
          dishId: d.dishId,
          name: d.dish.name,
          quantity: d.quantity,
          unitPrice: Number(d.unitPrice),
          subtotal: Number(d.subtotal),
          dishStatus: d.dishStatus,
          notes: d.notes ?? "",
        }));

        const calculatedTotal = items.reduce((acc, it) => acc + it.subtotal, 0);

        activeOrder = {
          id: order.id,
          orderTableId: activeTableOrder.id,
          code: order.code,
          orderType: order.orderType,
          orderedAt: order.orderedAt.toISOString(),
          status: order.status,
          tableNotes: activeTableOrder.notes ?? "",
          items,
          total: calculatedTotal,
          editable: !CLOSED_STATUSES.includes(order.status),
        };
      }

      return {
        id: m.id,
        number: m.number,
        capacity: m.capacity,
        active: m.active || Boolean(activeOrder),
        occupied: Boolean(activeOrder),
        activeOrder,
      };
    });

    const occupied = tables.filter((m) => m.occupied).length;
    const available = tables.filter((m) => m.active && !m.occupied).length;
    const inactive = tables.filter((m) => !m.active).length;

    return NextResponse.json({
      data: tables,
      summary: {
        total: tables.length,
        available,
        occupied,
        inactive,
      },
    });
  } catch (error) {
    console.error("[api/tables] Error al listar mesas:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la información de las mesas." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const number = Number(body.number ?? body.numero);
    const capacity = Number(body.capacity ?? body.capacidad ?? 4);

    if (!number || Number.isNaN(number) || number <= 0) {
      return NextResponse.json(
        { error: "El número de mesa debe ser un entero positivo mayor a cero." },
        { status: 400 }
      );
    }

    if (Number.isNaN(capacity) || capacity < 1 || capacity > 30) {
      return NextResponse.json(
        { error: "La capacidad de comensales debe estar entre 1 y 30 personas." },
        { status: 400 }
      );
    }

    // Verificar si ya existe una mesa con ese número
    const existingTable = await prisma.diningTable.findUnique({
      where: { number },
    });

    if (existingTable) {
      if (existingTable.active) {
        return NextResponse.json(
          { error: `Ya existe una mesa activa registrada con el número ${number}.` },
          { status: 409 }
        );
      }

      // Si existe pero estaba inactiva, se reactiva y actualiza su capacidad
      const reactivated = await prisma.diningTable.update({
        where: { id: existingTable.id },
        data: {
          active: true,
          capacity,
        },
      });

      return NextResponse.json(
        {
          message: `Mesa #${number} reactivada con éxito.`,
          data: reactivated,
        },
        { status: 200 }
      );
    }

    const newTable = await prisma.diningTable.create({
      data: {
        number,
        capacity,
        active: true,
      },
    });

    return NextResponse.json(
      {
        message: `Mesa #${number} registrada exitosamente.`,
        data: newTable,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/tables] Error al registrar mesa:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al registrar la mesa." },
      { status: 500 }
    );
  }
}
