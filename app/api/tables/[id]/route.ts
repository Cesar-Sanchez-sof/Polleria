import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/tables/{id}:
 *   put:
 *     tags:
 *       - Tables
 *     summary: Actualizar datos de una mesa (número, capacidad, activo)
 *   delete:
 *     tags:
 *       - Tables
 *     summary: Desactivar una mesa (Soft delete)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tableId = Number.parseInt(idParam, 10);
    if (Number.isNaN(tableId)) {
      return NextResponse.json({ error: "ID de mesa inválido." }, { status: 400 });
    }

    const table = await prisma.diningTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return NextResponse.json({ error: "Mesa no encontrada." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const newNumber = body.number !== undefined ? Number(body.number) : undefined;
    const newCapacity = body.capacity !== undefined ? Number(body.capacity) : undefined;
    const newActive = body.active !== undefined ? Boolean(body.active) : undefined;

    if (newNumber !== undefined && (Number.isNaN(newNumber) || newNumber <= 0)) {
      return NextResponse.json({ error: "El número de mesa debe ser un entero positivo." }, { status: 400 });
    }

    if (newCapacity !== undefined && (Number.isNaN(newCapacity) || newCapacity < 1 || newCapacity > 30)) {
      return NextResponse.json({ error: "La capacidad debe estar entre 1 y 30 comensales." }, { status: 400 });
    }

    // Si se cambia el número, verificar que no esté ocupado por otra mesa
    if (newNumber !== undefined && newNumber !== table.number) {
      const duplicate = await prisma.diningTable.findUnique({
        where: { number: newNumber },
      });
      if (duplicate && duplicate.id !== tableId) {
        return NextResponse.json(
          { error: `Ya existe otra mesa con el número ${newNumber}.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.diningTable.update({
      where: { id: tableId },
      data: {
        ...(newNumber !== undefined ? { number: newNumber } : {}),
        ...(newCapacity !== undefined ? { capacity: newCapacity } : {}),
        ...(newActive !== undefined ? { active: newActive } : {}),
      },
    });

    return NextResponse.json({
      message: `Mesa #${updated.number} actualizada correctamente.`,
      data: updated,
    });
  } catch (error: any) {
    console.error("[api/tables/[id]] Error al actualizar mesa:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la mesa." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tableId = Number.parseInt(idParam, 10);
    if (Number.isNaN(tableId)) {
      return NextResponse.json({ error: "ID de mesa inválido." }, { status: 400 });
    }

    const table = await prisma.diningTable.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            order: {
              status: { notIn: ["Closed", "Cancelled"] },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Mesa no encontrada." }, { status: 404 });
    }

    if (table.orders.length > 0) {
      return NextResponse.json(
        { error: `No se puede desactivar la Mesa #${table.number} porque tiene comandas activas en curso.` },
        { status: 400 }
      );
    }

    // Soft delete para preservar histórico
    const deactivated = await prisma.diningTable.update({
      where: { id: tableId },
      data: { active: false },
    });

    return NextResponse.json({
      message: `Mesa #${deactivated.number} desactivada del salón correctamente.`,
      data: deactivated,
    });
  } catch (error: any) {
    console.error("[api/tables/[id]] Error al desactivar mesa:", error);
    return NextResponse.json(
      { error: error.message || "Error al desactivar la mesa." },
      { status: 500 }
    );
  }
}
