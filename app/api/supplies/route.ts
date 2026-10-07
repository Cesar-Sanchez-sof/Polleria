import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/supplies:
 *   get:
 *     tags:
 *       - Stock
 *     summary: Listar insumos e ingredientes activos para recetas e inventario
 */
export async function GET() {
  try {
    const supplies = await prisma.supply.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        type: true,
        unitOfMeasure: true,
        currentStock: true,
        lastCost: true,
        averageCost: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      data: supplies.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        unitOfMeasure: s.unitOfMeasure,
        currentStock: Number(s.currentStock),
        lastCost: Number(s.lastCost),
        averageCost: Number(s.averageCost),
      })),
    });
  } catch (error: any) {
    console.error("[api/supplies] Error al obtener insumos:", error);
    return NextResponse.json({ error: "Error al listar insumos." }, { status: 500 });
  }
}
