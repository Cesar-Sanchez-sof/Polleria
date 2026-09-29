import type { NextRequest } from "next/server";
import { fechaUTC } from "@/lib/fechas";
import { generarCodigoAsiento } from "@/lib/codigo-asiento";

export const dynamic = "force-dynamic";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sugiere el número (`MISC/AAAA/MM/NNNN`) que recibiría un asiento manual en
 * la fecha indicada. Es sólo una vista previa: el número definitivo se genera
 * en el instante de crear el asiento.
 */
export async function GET(request: NextRequest) {
  try {
    const parametro = request.nextUrl.searchParams.get("fecha");
    const fecha = parametro && FECHA_RE.test(parametro) ? fechaUTC(parametro) : new Date();

    const codigo = await generarCodigoAsiento(fecha);

    return Response.json({ codigo });
  } catch (error) {
    console.error("[api/asientos/siguiente-codigo] error al sugerir el número:", error);
    return Response.json(
      { error: "No se pudo obtener el número sugerido del asiento." },
      { status: 500 }
    );
  }
}
