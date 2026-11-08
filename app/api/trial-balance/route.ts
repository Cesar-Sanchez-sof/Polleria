import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { generateTrialBalanceReport } from "@/lib/services/accounting-reports.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/trial-balance?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Balance de Comprobación (saldos inicial, del periodo y final)
 * agrupado por elemento y sub-elemento del plan contable.
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const rawFrom = searchParams.get("desde");
      const rawTo = searchParams.get("hasta");
      const result = await generateTrialBalanceReport(rawFrom, rawTo);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/trial-balance] error:", error);
      return NextResponse.json(
        { error: "No se pudo generar el balance de comprobación." },
        { status: 500 }
      );
    }
  },
});
