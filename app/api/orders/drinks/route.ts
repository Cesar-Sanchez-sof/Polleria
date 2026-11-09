import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  listDrinksDispatch,
  updateDrinkItemStatus,
  type UpdateDrinkStatusInput,
} from "@/lib/services/sales/orders.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/orders/drinks:
 *   get:
 *     tags:
 *       - Drinks
 *     summary: Lista las bebidas de comandas activas organizadas por mesa
 *   patch:
 *     tags:
 *       - Drinks
 *     summary: Cambia el estado de entrega de una bebida (Pending / Delivered)
 */

export const GET = createApiHandler({
  permission: "pedidos.ver",
  handler: async ({ searchParams }) => {
    const status = searchParams.get("status");
    const table = searchParams.get("table");
    const result = await listDrinksDispatch({ status, table });
    return NextResponse.json(result);
  },
});

export const PATCH = createApiHandler<UpdateDrinkStatusInput>({
  permission: "pedidos.editar",
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => null);
    const result = await updateDrinkItemStatus(rawBody);
    return NextResponse.json(result);
  },
});
