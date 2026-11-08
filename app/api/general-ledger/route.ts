import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { getGeneralLedgerReportDomain } from "@/lib/services/accounting-ledgers.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/general-ledger
 * General Ledger (Libro Mayor): account movements in chronological order
 * with running balance and period totals.
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const code = searchParams.get("codigo");
      const fromDate = searchParams.get("desde");
      const toDate = searchParams.get("hasta");

      const result = await getGeneralLedgerReportDomain({
        code,
        fromDate,
        toDate,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/general-ledger] error al obtener el libro mayor:", error);
      return NextResponse.json(
        { error: "No se pudo obtener el libro mayor." },
        { status: 500 }
      );
    }
  },
});
