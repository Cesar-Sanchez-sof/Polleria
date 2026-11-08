import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  listOrders,
  createOrder,
  type CreateOrderInput,
} from "@/lib/services/orders.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Listar pedidos
 *   post:
 *     tags:
 *       - Orders
 *     summary: Crear un nuevo pedido
 */

export const GET = createApiHandler({
  permission: ["pedidos.ver", "cocina.ver", "ventas.ver"],
  handler: async ({ searchParams }) => {
    const orderType = searchParams.get("orderType") ?? searchParams.get("tipo");
    const status = searchParams.get("status") ?? searchParams.get("estado");
    const orders = await listOrders({ orderType, status });
    return NextResponse.json({ data: orders });
  },
});

export const POST = createApiHandler<CreateOrderInput>({
  permission: ["pedidos.crear", "ventas.crear"],
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => null);
    const result = await createOrder(rawBody);
    return NextResponse.json(result, { status: 201 });
  },
});
