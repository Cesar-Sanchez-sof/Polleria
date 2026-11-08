import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { getDailyBookEntriesDomain } from "@/lib/services/accounting/accounting-ledgers.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-book
 * General Journal (Libro Diario): journal entries in reverse chronological order
 * with all their line items and totals.
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const fromDate = searchParams.get("desde");
      const toDate = searchParams.get("hasta");
      const page = searchParams.get("page");
      const pageSize = searchParams.get("pageSize");

      const result = await getDailyBookEntriesDomain({
        fromDate,
        toDate,
        page,
        pageSize,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/daily-book] error al obtener el libro diario:", error);
      return NextResponse.json(
        { error: "No se pudo obtener el libro diario." },
        { status: 500 }
      );
    }
  },
});
