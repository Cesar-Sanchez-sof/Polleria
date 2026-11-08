import { NextResponse } from "next/server";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import {
  updateDiningTable,
  deactivateDiningTable,
} from "@/lib/services/sales/dining-tables.service";

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

export const PUT = createApiHandler<
  { number?: number; capacity?: number; active?: boolean },
  { id: string }
>({
  permission: "mesas.editar",
  handler: async ({ params, body }) => {
    const tableId = Number.parseInt(params.id, 10);
    if (Number.isNaN(tableId)) {
      throw new ValidationError("ID de mesa inválido.");
    }

    const payload = body || {};
    const updated = await updateDiningTable(tableId, {
      number: payload.number !== undefined ? Number(payload.number) : undefined,
      capacity: payload.capacity !== undefined ? Number(payload.capacity) : undefined,
      active: payload.active !== undefined ? Boolean(payload.active) : undefined,
    });

    return NextResponse.json({
      message: `Mesa #${updated.number} actualizada correctamente.`,
      data: updated,
    });
  },
});

export const DELETE = createApiHandler<unknown, { id: string }>({
  permission: "mesas.eliminar",
  handler: async ({ params }) => {
    const tableId = Number.parseInt(params.id, 10);
    if (Number.isNaN(tableId)) {
      throw new ValidationError("ID de mesa inválido.");
    }

    const deactivated = await deactivateDiningTable(tableId);

    return NextResponse.json({
      message: `Mesa #${deactivated.number} desactivada del salón correctamente.`,
      data: deactivated,
    });
  },
});
