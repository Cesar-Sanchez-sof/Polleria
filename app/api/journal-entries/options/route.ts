import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { getJournalOptionsDomain } from "@/lib/services/journal-entries-domain.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal-entries/options
 * Obtiene los valores de filtrado disponibles para la lista de asientos contables.
 */
export const GET = createApiHandler({
  permission: ["asientos.ver", "asientos.crear"],
  handler: async () => {
    try {
      const result = await getJournalOptionsDomain();
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/journal-entries/options] error al obtener opciones:", error);
      return NextResponse.json(
        { error: "No se pudieron obtener las opciones de filtrado." },
        { status: 500 }
      );
    }
  },
});
