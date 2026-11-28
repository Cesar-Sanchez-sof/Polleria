import { beforeEach, describe, expect, it, vi } from "vitest";
import { listActivePaymentMethods } from "@/lib/services/sales/payment-methods.service";

const m = vi.hoisted(() => ({
  paymentTypeFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentType: {
      findMany: m.paymentTypeFindMany,
    },
  },
}));

describe("PaymentMethodsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe listar métodos de pago activos configurando capacidades de pasarela", async () => {
    m.paymentTypeFindMany.mockResolvedValueOnce([
      { id: 1, name: "Efectivo", active: true },
      { id: 2, name: "Yape", active: true },
      { id: 3, name: "Tarjeta POS Visa", active: true },
    ]);

    const result = await listActivePaymentMethods();

    expect(result).toHaveLength(3);

    // Efectivo
    expect(result[0].name).toBe("Efectivo");
    expect(result[0].gatewayConfig.supportsQr).toBe(false);
    expect(result[0].gatewayConfig.supportsTapToPay).toBe(false);

    // Yape
    expect(result[1].name).toBe("Yape");
    expect(result[1].gatewayConfig.supportsQr).toBe(true);
    expect(result[1].gatewayConfig.supportsTapToPay).toBe(false);

    // Tarjeta POS
    expect(result[2].name).toBe("Tarjeta POS Visa");
    expect(result[2].gatewayConfig.supportsTapToPay).toBe(true);
    expect(result[2].gatewayConfig.supportsQr).toBe(false);

    expect(m.paymentTypeFindMany).toHaveBeenCalledWith({
      where: {
        active: true,
        NOT: { name: { contains: "plin", mode: "insensitive" } },
      },
      orderBy: { id: "asc" },
    });
  });
});
