import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getRestaurantInfo } from "@/lib/services/restaurant-config.service";
import { getVoucherPresignedUrl } from "@/lib/services/s3-storage.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/settings/restaurant/qr:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Obtener y visualizar la imagen oficial del QR de Yape del restaurante
 */
export async function GET(request: NextRequest) {
  try {
    const restaurant = await getRestaurantInfo();
    const qrUrl = restaurant.yapeQrImageUrl?.trim();

    if (!qrUrl) {
      return NextResponse.json({ error: "No hay código QR configurado." }, { status: 404 });
    }

    // 1. Si es una ruta local de public/storage, servir el archivo directamente
    if (qrUrl.startsWith("/storage/")) {
      const localFilePath = path.join(process.cwd(), "public", qrUrl);
      if (fs.existsSync(localFilePath)) {
        const fileBuffer = fs.readFileSync(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase();
        const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
          },
        });
      }
    }

    // 2. Si es una URL o clave de S3 remoto, generar presigned URL y redirigir
    const presigned = await getVoucherPresignedUrl(qrUrl, 3600);
    if (presigned) {
      return NextResponse.redirect(presigned, 302);
    }

    // 3. Fallback: verificar si existe copia física local en public/storage/comprobantes/...
    const s3Key = qrUrl.includes("/comprobantes/")
      ? qrUrl.substring(qrUrl.indexOf("/comprobantes/") + "/comprobantes/".length)
      : path.basename(qrUrl);
    const localFallback = path.join(process.cwd(), "public", "storage", "comprobantes", s3Key);
    if (fs.existsSync(localFallback)) {
      const fileBuffer = fs.readFileSync(localFallback);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
      });
    }

    // 4. Si la URL es pública externa directa
    if (qrUrl.startsWith("http")) {
      return NextResponse.redirect(qrUrl, 302);
    }

    return NextResponse.json({ error: "Código QR no encontrado en almacenamiento." }, { status: 404 });
  } catch (error: any) {
    console.error("[api/settings/restaurant/qr] Error al recuperar QR:", error);
    return NextResponse.json({ error: "Error interno al recuperar código QR." }, { status: 500 });
  }
}
