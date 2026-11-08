import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { getJournalEntryByIdDomain } from "@/lib/services/journal-entries-domain.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal-entries/[id]
 * Obtener detalle de asiento contable.
 */
export const GET = createApiHandler({
  permission: "asientos.ver",
  handler: async ({ params }) => {
    try {
      const idParam = String(params.id ?? "");
      const result = await getJournalEntryByIdDomain(idParam);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/journal-entries/[id]] error al obtener el asiento:", error);
      return NextResponse.json(
        { error: "No se pudo obtener el detalle del asiento contable." },
        { status: 500 }
      );
    }
  },
});
