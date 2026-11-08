import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { listLocalPurchasesForReconciliation } from "@/lib/services/purchases/invoices";

export const dynamic = "force-dynamic";

/**
 * Devuelve los comprobantes de compras locales para cotejo / conciliación con SIRE.
 */
export const GET = createApiHandler({
  permission: "compras.ver",
  handler: async () => {
    const formatted = await listLocalPurchasesForReconciliation();
    return NextResponse.json(formatted, {
      headers: { "Cache-Control": "no-store" },
    });
  },
});
