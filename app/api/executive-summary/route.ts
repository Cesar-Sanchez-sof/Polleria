import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { generateExecutiveSummaryReport } from "@/lib/services/accounting-reports.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/executive-summary?year=YYYY
 *
 * Resumen Ejecutivo de un ejercicio (año calendario).
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const rawYear = searchParams.get("year");
      const result = await generateExecutiveSummaryReport(rawYear);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/executive-summary] error:", error);
      return NextResponse.json(
        { error: "No se pudo generar el resumen ejecutivo." },
        { status: 500 }
      );
    }
  },
});
