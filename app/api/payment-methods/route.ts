import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/payment-methods:
 *   get:
 *     tags:
 *       - PaymentMethods
 *     summary: Listar métodos de pago disponibles
 */

export async function GET(_request: NextRequest) {
  try {
    const paymentTypesDb = await prisma.paymentType.findMany({
      where: { active: true },
      orderBy: { id: "asc" }
    });

    const data = paymentTypesDb.map((tp) => ({
      id: tp.id,
      name: tp.name,
      active: tp.active,
      gatewayConfig: {
        supportsTapToPay: tp.name.toLowerCase().includes("pos") || tp.name.toLowerCase().includes("tarjeta"),
        supportsQr: tp.name.toLowerCase().includes("yape"),
        preparedProvider: "mercado_pago"
      }
    }));

    return Response.json({ data });
  } catch (error) {
    console.error("[api/payment-methods] Error al listar tipos de pago:", error);
    return Response.json(
      { error: "No se pudieron obtener los métodos de pago." },
      { status: 500 }
    );
  }
}
