import { NextRequest, NextResponse } from "next/server";
import {
  getRestaurantGlobalConfig,
  updatePrinterConfig,
  type PrinterConfig,
} from "@/lib/services/restaurant-config.service";
import { authorize } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorize(["configuracion.ver", "ventas.ver"]);
  if (!auth.ok) return auth.response;
  try {
    const config = getRestaurantGlobalConfig();
    return NextResponse.json({ data: config.printers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo obtener la configuración de comprobantes e impresión." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authorize("configuracion.editar");
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => null)) as Partial<PrinterConfig> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Datos de entrada inválidos." }, { status: 400 });
    }

    const updated = updatePrinterConfig(body);
    return NextResponse.json({
      message: "Configuración de impresión y comprobantes actualizada.",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al actualizar la configuración de impresión." },
      { status: 500 }
    );
  }
}
