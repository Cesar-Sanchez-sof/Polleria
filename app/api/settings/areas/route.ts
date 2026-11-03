import { NextResponse } from "next/server";
import {
  listEnrichedDiningAreas,
  saveDiningArea,
  deleteDiningArea,
  type DiningArea,
} from "@/lib/services/restaurant-config.service";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/settings/areas:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Obtener listado de salones y áreas con aforos calculados
 *   post:
 *     tags:
 *       - Settings
 *     summary: Registrar un nuevo salón o área
 *   put:
 *     tags:
 *       - Settings
 *     summary: Actualizar un salón o área existente
 *   delete:
 *     tags:
 *       - Settings
 *     summary: Eliminar un salón o área
 */

export const GET = createApiHandler({
  permission: ["configuracion.ver", "mesas.ver", "pedidos.ver"],
  handler: async () => {
    return listEnrichedDiningAreas();
  },
});

export const POST = createApiHandler<Partial<DiningArea>>({
  permission: "configuracion.editar",
  handler: async ({ body }) => {
    if (!body || !body.name || typeof body.name !== "string") {
      throw new ValidationError("El nombre del área o salón es requerido.");
    }

    const newArea: DiningArea = {
      id: `area-${Date.now()}`,
      name: body.name.trim(),
      level: body.level?.trim() || "Piso 1",
      description: body.description?.trim() || "",
      tableNumbers: Array.isArray(body.tableNumbers)
        ? body.tableNumbers.map(Number).filter((n: number) => !Number.isNaN(n))
        : [],
      active: body.active !== false,
      color: body.color || "emerald",
    };

    const updatedList = await saveDiningArea(newArea);
    return NextResponse.json(
      { message: "Salón / Área registrado con éxito.", data: updatedList },
      { status: 201 }
    );
  },
});

export const PUT = createApiHandler<DiningArea>({
  permission: "configuracion.editar",
  handler: async ({ body }) => {
    if (!body || !body.id) {
      throw new ValidationError("ID del salón a actualizar es requerido.");
    }

    const updatedList = await saveDiningArea(body);
    return NextResponse.json({
      message: "Salón / Área actualizado con éxito.",
      data: updatedList,
    });
  },
});

export const DELETE = createApiHandler({
  permission: "configuracion.editar",
  handler: async ({ searchParams }) => {
    const id = searchParams.get("id");
    if (!id) {
      throw new ValidationError("ID del salón a eliminar es requerido.");
    }

    const updatedList = await deleteDiningArea(id);
    return NextResponse.json({
      message: "Salón eliminado con éxito.",
      data: updatedList,
    });
  },
});
