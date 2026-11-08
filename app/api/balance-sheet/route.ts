import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { generateBalanceSheetReport } from "@/lib/services/accounting-reports.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/balance-sheet?hasta=YYYY-MM-DD
 *
 * Estado de Situación Financiera (Balance General) a una fecha de corte.
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const rawAsOf = searchParams.get("hasta");
      const result = await generateBalanceSheetReport(rawAsOf);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/balance-sheet] error:", error);
      return NextResponse.json(
        { error: "No se pudo generar el balance general." },
        { status: 500 }
      );
    }
  },
});
