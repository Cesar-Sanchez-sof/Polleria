import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listDiningAreas,
  saveDiningArea,
  deleteDiningArea,
  type DiningArea,
} from "@/lib/services/restaurant-config.service";
import { autorizar } from "@/lib/auth/permisos";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await autorizar(["configuracion.ver", "mesas.ver", "pedidos.ver"]);
  if (!auth.ok) return auth.respuesta;
  try {
    const areas = listDiningAreas();

    // Consultamos las mesas para calcular aforos y ocupación real por cada salón
    const tables = await prisma.diningTable.findMany({
      select: { id: true, number: true, capacity: true, active: true },
      orderBy: { number: "asc" },
    });

    const tablesMap = new Map(tables.map((t) => [t.number, t]));

    const enrichedAreas = areas.map((area) => {
      const areaTables = area.tableNumbers
        .map((num) => tablesMap.get(num))
        .filter(Boolean) as Array<{ id: number; number: number; capacity: number; active: boolean }>;

      const totalCapacity = areaTables.reduce((acc, t) => acc + t.capacity, 0);

      return {
        ...area,
        tableCount: areaTables.length,
        totalCapacity,
        tables: areaTables,
      };
    });

    return NextResponse.json({
      data: enrichedAreas,
      allTables: tables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudieron obtener los salones y áreas." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await autorizar("configuracion.editar");
  if (!auth.ok) return auth.respuesta;
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "El nombre del área o salón es requerido." }, { status: 400 });
    }

    const newArea: DiningArea = {
      id: `area-${Date.now()}`,
      name: body.name.trim(),
      level: body.level?.trim() || "Piso 1",
      description: body.description?.trim() || "",
      tableNumbers: Array.isArray(body.tableNumbers) ? body.tableNumbers.map(Number).filter((n: number) => !Number.isNaN(n)) : [],
      active: body.active !== false,
      color: body.color || "emerald",
    };

    const updatedList = saveDiningArea(newArea);
    return NextResponse.json(
      { message: "Salón / Área registrado con éxito.", data: updatedList },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al registrar el salón." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await autorizar("configuracion.editar");
  if (!auth.ok) return auth.respuesta;
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.id) {
      return NextResponse.json({ error: "ID del salón a actualizar es requerido." }, { status: 400 });
    }

    const updatedList = saveDiningArea(body);
    return NextResponse.json({
      message: "Salón / Área actualizado con éxito.",
      data: updatedList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al actualizar el salón." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await autorizar("configuracion.editar");
  if (!auth.ok) return auth.respuesta;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID del salón a eliminar es requerido." }, { status: 400 });
    }

    const updatedList = deleteDiningArea(id);
    return NextResponse.json({
      message: "Salón eliminado con éxito.",
      data: updatedList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al eliminar el salón." },
      { status: 500 }
    );
  }
}
