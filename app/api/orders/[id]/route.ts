import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  getOrderById,
  updateOrder,
  cancelOrder,
  type UpdateOrderInput,
} from "@/lib/services/orders.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Obtener detalle de pedido por ID
 *   put:
 *     tags:
 *       - Orders
 *     summary: Actualizar pedido existente
 *   delete:
 *     tags:
 *       - Orders
 *     summary: Cancelar pedido existente
 */

export const GET = createApiHandler<unknown, { id: string }>({
  permission: ["pedidos.ver", "cocina.ver", "ventas.ver"],
  handler: async ({ params }) => {
    const id = Number(params?.id);
    const order = await getOrderById(id);
    return NextResponse.json(order);
  },
});

export const PUT = createApiHandler<UpdateOrderInput, { id: string }>({
  permission: "pedidos.editar",
  handler: async ({ params, body, req }) => {
    const id = Number(params?.id);
    const rawBody = body !== undefined ? body : await req.json().catch(() => ({}));
    const updated = await updateOrder(id, rawBody);
    return NextResponse.json(updated);
  },
});

export const DELETE = createApiHandler<unknown, { id: string }>({
  permission: "pedidos.eliminar",
  handler: async ({ params }) => {
    const id = Number(params?.id);
    const result = await cancelOrder(id);
    return NextResponse.json(result);
  },
});
