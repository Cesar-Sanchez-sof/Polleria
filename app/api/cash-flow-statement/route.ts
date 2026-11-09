import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { generateCashFlowStatementReport } from "@/lib/services/accounting/accounting-reports.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cash-flow-statement?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Genera el Estado de Flujos de Efectivo (método indirecto, NIC 7 / PCGE 2019) para un período.
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const from = searchParams.get("desde");
      const to = searchParams.get("hasta");
      const result = await generateCashFlowStatementReport(from, to);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/cash-flow-statement] error:", error);
      return NextResponse.json(
        { error: "No se pudo generar el Estado de Flujos de Efectivo." },
        { status: 500 }
      );
    }
  },
});
