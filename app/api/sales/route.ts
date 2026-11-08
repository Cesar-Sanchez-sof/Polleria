import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import {
  registerSale,
  listSalesVouchers,
  type RegisterSaleInput,
} from "@/lib/services/sales.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/sales:
 *   post:
 *     tags:
 *       - Sales
 *     summary: Registrar una venta
 *   get:
 *     tags:
 *       - Sales
 *     summary: Listar ventas
 */

// Nota de diseño: La resolución dinámica de series y correlativos delega a getPrinterConfig() dentro de sales.service
export const POST = createApiHandler<RegisterSaleInput>({
  permission: "ventas.crear",
  handler: async ({ body, req }) => {
    const rawBody = body !== undefined ? body : await req.json().catch(() => null);
    const result = await registerSale(rawBody);
    return NextResponse.json(result, { status: 201 });
  },
});

export const GET = createApiHandler({
  permission: "ventas.ver",
  handler: async ({ searchParams }) => {
    const dateParam = searchParams.get("date") ?? searchParams.get("fecha");
    const result = await listSalesVouchers({ date: dateParam });
    return NextResponse.json(result);
  },
});
