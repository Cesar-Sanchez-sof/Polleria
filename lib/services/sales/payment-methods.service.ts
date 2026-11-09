import { prisma } from "@/lib/prisma";

export interface PaymentGatewayConfig {
  supportsTapToPay: boolean;
  supportsQr: boolean;
  preparedProvider: string;
}

export interface PaymentMethodDto {
  id: number;
  name: string;
  active: boolean;
  gatewayConfig: PaymentGatewayConfig;
}

/**
 * Consulta y devuelve los métodos de pago activos con su configuración de pasarela asociada.
 */
export async function listActivePaymentMethods(): Promise<PaymentMethodDto[]> {
  const paymentTypesDb = await prisma.paymentType.findMany({
    where: {
      active: true,
      NOT: { name: { contains: "plin", mode: "insensitive" } },
    },
    orderBy: { id: "asc" },
  });

  return paymentTypesDb.map((tp) => ({
    id: tp.id,
    name: tp.name,
    active: tp.active,
    gatewayConfig: {
      supportsTapToPay:
        tp.name.toLowerCase().includes("pos") || tp.name.toLowerCase().includes("tarjeta"),
      supportsQr: tp.name.toLowerCase().includes("yape"),
      preparedProvider: "mercado_pago",
    },
  }));
}
