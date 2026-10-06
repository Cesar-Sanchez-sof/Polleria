import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVoucherPresignedUrl } from "@/lib/services/s3-storage.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/sales/voucher/{id}:
 *   get:
 *     tags:
 *       - Sales
 *     summary: Consultar y descargar o visualizar el comprobante almacenado en S3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const voucherId = Number.parseInt(idParam, 10);

    if (Number.isNaN(voucherId)) {
      return NextResponse.json({ error: "ID de comprobante inválido." }, { status: 400 });
    }

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: voucherId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format");

    let downloadUrl: string | null = null;
    if (invoice.s3Url) {
      downloadUrl = await getVoucherPresignedUrl(invoice.s3Url, 3600);
    }

    // Si el cliente pide metadata en formato JSON
    if (format === "json") {
      return NextResponse.json({
        id: invoice.id,
        invoiceCode: `${invoice.series}-${String(invoice.number).padStart(6, "0")}`,
        s3Url: invoice.s3Url,
        downloadUrl: downloadUrl || invoice.s3Url,
        issuedAt: invoice.issuedAt,
        total: invoice.totalAmount,
      });
    }

    // Si tenemos la URL firmada de S3, redirigir directamente
    if (downloadUrl) {
      return NextResponse.redirect(downloadUrl, 302);
    }

    // Si tiene s3Url pero no se pudo generar presigned (ej: modo local)
    if (invoice.s3Url) {
      if (invoice.s3Url.startsWith("/")) {
        return NextResponse.redirect(new URL(invoice.s3Url, request.url), 302);
      }
      return NextResponse.redirect(invoice.s3Url, 302);
    }

    return NextResponse.json(
      { error: "El comprobante no tiene una ubicación S3 registrada aún." },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[api/sales/voucher/[id]] Error al consultar comprobante S3:", error);
    return NextResponse.json(
      { error: "Error al consultar el comprobante en almacenamiento." },
      { status: 500 }
    );
  }
}
