import type { NextRequest } from "next/server";
import { parseUtcDate } from "@/lib/fechas";
import { generateJournalEntryCode } from "@/lib/codigo-asiento";

export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Suggests the code (`MISC/YYYY/MM/NNNN`) that a manual journal entry would receive
 * for the specified date. This is only a preview: the definitive code is assigned
 * at the moment of entry creation.
 */
export async function GET(request: NextRequest) {
  try {
    const param = request.nextUrl.searchParams.get("fecha");
    const date = param && DATE_REGEX.test(param) ? parseUtcDate(param) : new Date();

    const code = await generateJournalEntryCode(date);

    return Response.json({ codigo: code });
  } catch (error) {
    console.error("[api/asientos/siguiente-codigo] error al sugerir el número:", error);
    return Response.json(
      { error: "No se pudo obtener el número sugerido del asiento." },
      { status: 500 }
    );
  }
}
