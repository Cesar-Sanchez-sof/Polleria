import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import {
  interpretAccountingReport,
  type ReportInterpretationRequest,
} from "@/lib/services/accounting-interpreter.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await authorize("reportes.ver");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ReportInterpretationRequest;
    if (!body || !body.data || !body.reportType) {
      return NextResponse.json(
        { error: "Faltan datos requeridos (reportType y data)." },
        { status: 400 }
      );
    }

    const interpretation = await interpretAccountingReport(body);
    return NextResponse.json(interpretation, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error en /api/accounting/interpreter:", error);
    const message = error instanceof Error ? error.message : "Error interno al interpretar el reporte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
