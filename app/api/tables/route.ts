import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  listDiningTables,
  createOrReactivateDiningTable,
} from "@/lib/services/sales/dining-tables.service";

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

export const GET = createApiHandler({
  permission: ["mesas.ver", "pedidos.ver"],
  handler: async ({ searchParams }) => {
    const includeInactive = searchParams.get("includeInactive") === "true";
    const result = await listDiningTables({ includeInactive });
    return NextResponse.json(result);
  },
});

export const POST = createApiHandler({
  permission: "mesas.crear",
  handler: async ({ body }) => {
    const payload = (body || {}) as { number?: number; capacity?: number };
    const result = await createOrReactivateDiningTable({
      number: Number(payload.number),
      capacity: payload.capacity !== undefined ? Number(payload.capacity) : undefined,
    });

    return NextResponse.json(
      {
        message: result.message,
        data: result.table,
      },
      { status: result.reactivated ? 200 : 201 }
    );
  },
});
