import { NextRequest, NextResponse } from "next/server";
import {
  getPrinterConfig,
  updatePrinterConfig,
  type PrinterConfig,
} from "@/lib/services/restaurant-config.service";
import { authorize } from "@/lib/auth/permissions";
import { isValidVoucherSeries } from "@/lib/utils/series-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorize(["configuracion.ver", "ventas.ver"]);
  if (!auth.ok) return auth.response;
  try {
    const printers = await getPrinterConfig();
    return NextResponse.json({ data: printers });
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

    if (body.series) {
      if (body.series.boleta !== undefined && !isValidVoucherSeries(body.series.boleta, "Boleta")) {
        return NextResponse.json(
          { error: `Serie de boleta inválida "${body.series.boleta}". Debe cumplir con el formato B### (ej. B001, B002).` },
          { status: 400 }
        );
      }
      if (body.series.factura !== undefined && !isValidVoucherSeries(body.series.factura, "Factura")) {
        return NextResponse.json(
          { error: `Serie de factura inválida "${body.series.factura}". Debe cumplir con el formato F### (ej. F001, F002).` },
          { status: 400 }
        );
      }
    }

    const updated = await updatePrinterConfig(body);
    return NextResponse.json({
      message: "Configuración de impresión y comprobantes actualizada.",
      data: updated,
    });
  } catch (error: any) {
    const isValidationError = error?.message?.includes("Serie de");
    return NextResponse.json(
      { error: error?.message || "Error al actualizar la configuración de impresión." },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
