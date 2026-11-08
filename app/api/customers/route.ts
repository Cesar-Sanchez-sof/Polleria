import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  searchCustomers,
  createCustomer,
  type CreateCustomerInput,
} from "@/lib/services/sales/customers.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/customers:
 *   get:
 *     tags:
 *       - Customers
 *     summary: Lista clientes
 *     description: Obtiene una lista de clientes con sus datos básicos y total de compras.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Texto de búsqueda para nombre, apellido o documento.
 *   post:
 *     tags:
 *       - Customers
 *     summary: Crear nuevo cliente
 *     description: Registra un cliente con datos validados.
 */

export const GET = createApiHandler({
  permission: ["clientes.ver", "ventas.ver"],
  handler: async ({ searchParams }) => {
    const q = searchParams.get("q") || "";
    const result = await searchCustomers(q);
    return NextResponse.json({ data: result });
  },
});

export const POST = createApiHandler<CreateCustomerInput>({
  permission: ["clientes.crear", "ventas.crear"],
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => null);
    const result = await createCustomer(rawBody);
    return NextResponse.json(result, { status: 201 });
  },
});
