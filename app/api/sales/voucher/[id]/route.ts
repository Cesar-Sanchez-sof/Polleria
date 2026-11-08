import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { getVoucherDetailsById } from "@/lib/services/sales/sales.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/sales/voucher/{id}:
 *   get:
 *     tags:
 *       - Sales
 *     summary: Consultar y descargar o visualizar el comprobante almacenado en S3
 */

export const GET = createApiHandler<unknown, { id: string }>({
  permission: "ventas.ver",
  handler: async ({ params, searchParams, req }) => {
    const voucherId = Number(params?.id);
    const format = searchParams.get("format");
    const details = await getVoucherDetailsById(voucherId, format);

    if (format === "json") {
      return NextResponse.json(details);
    }

    if (details.downloadUrl) {
      return NextResponse.redirect(details.downloadUrl, 302);
    }

    if (details.s3Url) {
      if (details.s3Url.startsWith("/")) {
        return NextResponse.redirect(new URL(details.s3Url, req.url), 302);
      }
      return NextResponse.redirect(details.s3Url, 302);
    }

    return NextResponse.json(
      { error: "El comprobante no tiene una ubicación S3 registrada aún." },
      { status: 404 }
    );
  },
});
