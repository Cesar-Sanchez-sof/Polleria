import { createApiHandler } from "@/lib/http/route-handler";
import { listActivePaymentMethods } from "@/lib/services/sales/payment-methods.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payment-methods:
 *   get:
 *     tags:
 *       - PaymentMethods
 *     summary: Listar métodos de pago disponibles
 */
export const GET = createApiHandler({
  handler: async () => {
    const data = await listActivePaymentMethods();
    return { data };
  },
});
