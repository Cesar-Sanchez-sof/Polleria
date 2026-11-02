import { NextResponse } from "next/server";
import {
  getPrinterConfig,
  updatePrinterConfig,
  type PrinterConfig,
} from "@/lib/services/restaurant-config.service";
import { isValidVoucherSeries } from "@/lib/utils/series-validation";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/settings/printers:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Obtener configuración de impresoras térmicas y series de comprobante
 *   put:
 *     tags:
 *       - Settings
 *     summary: Actualizar configuración de impresoras térmicas y series
 */

export const GET = createApiHandler({
  permission: ["configuracion.ver", "ventas.ver"],
  handler: async () => {
    const printers = await getPrinterConfig();
    return { data: printers };
  },
});

export const PUT = createApiHandler<Partial<PrinterConfig>>({
  permission: "configuracion.editar",
  handler: async ({ body }) => {
    if (!body || typeof body !== "object") {
      throw new ValidationError("Datos de entrada inválidos.");
    }

    if (body.series) {
      if (body.series.boleta !== undefined && !isValidVoucherSeries(body.series.boleta, "Boleta")) {
        throw new ValidationError(
          `Serie de boleta inválida "${body.series.boleta}". Debe cumplir con el formato B### (ej. B001, B002).`
        );
      }
      if (body.series.factura !== undefined && !isValidVoucherSeries(body.series.factura, "Factura")) {
        throw new ValidationError(
          `Serie de factura inválida "${body.series.factura}". Debe cumplir con el formato F### (ej. F001, F002).`
        );
      }
    }

    const updated = await updatePrinterConfig(body);
    return NextResponse.json({
      message: "Configuración de impresión y comprobantes actualizada.",
      data: updated,
    });
  },
});
