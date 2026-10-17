import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import { isSireTestBook, simulateSireSubmission } from "@/lib/sire/local-simulator";
import { loadPleSnapshot } from "@/lib/services/ple.service";

export const dynamic = "force-dynamic";

/**
 * Local-only SIRE test endpoint. It shares PLE's source data and validation but deliberately
 * makes no external request, so it cannot send a register to SUNAT.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ book: string }> }
) {
  const auth = await authorize("reportes.ver");
  if (!auth.ok) return auth.response;

  try {
    const { book } = await params;
    if (!isSireTestBook(book)) {
      return Response.json({ error: "Solo se pueden probar los registros de ventas y compras." }, { status: 400 });
    }

    const body = (await request.json()) as { year?: unknown; month?: unknown };
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return Response.json({ error: "El año debe estar entre 2000 y 2100." }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ error: "El mes debe estar entre 1 y 12." }, { status: 400 });
    }

    const snapshot = await loadPleSnapshot(year, month);
    if (!/^\d{11}$/.test(snapshot.taxpayer.ruc)) {
      return Response.json({ error: "Configura un RUC de 11 dígitos antes de probar SIRE." }, { status: 409 });
    }

    const submission = simulateSireSubmission(book, snapshot);
    return Response.json(submission, { status: 200 });
  } catch (error) {
    console.error("[api/sire/test] local simulation failed:", error);
    return Response.json({ error: "No se pudo completar la prueba local de SIRE." }, { status: 500 });
  }
}
