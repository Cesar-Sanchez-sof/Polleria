import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { getJournalAccountsDomain } from "@/lib/services/accounting/journal-entries-domain.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal-entries/accounts
 * Chart of accounts available to build lines in a manual journal entry.
 */
export const GET = createApiHandler({
  permission: ["asientos.ver", "asientos.crear"],
  handler: async () => {
    try {
      const result = await getJournalAccountsDomain();
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/journal-entries/accounts] error al obtener el plan contable:", error);
      return NextResponse.json(
        { error: "No se pudo obtener el plan contable." },
        { status: 500 }
      );
    }
  },
});
