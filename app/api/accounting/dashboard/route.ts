import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { generateAccountingDashboardReport } from "@/lib/services/accounting/accounting-reports.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/dashboard?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Dashboard contable: KPIs del período con variación vs el período anterior,
 * serie mensual (12 meses), distribución de gastos por categoría PCGE y
 * cuentas con mayor movimiento.
 */
export const GET = createApiHandler({
  permission: "reportes.ver",
  handler: async ({ searchParams }) => {
    try {
      const from = searchParams.get("desde");
      const to = searchParams.get("hasta");
      const result = await generateAccountingDashboardReport(from, to);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/accounting/dashboard] error:", error);
      return NextResponse.json(
        { error: "No se pudo generar el Dashboard Contable." },
        { status: 500 }
      );
    }
  },
});
