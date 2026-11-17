import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getS3Config } from "@/lib/services/integrations/s3-storage.service";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

/**
 * Endpoint proxy de imágenes guardadas en S3 (Neon Object Storage) o en disco local.
 * Las URLs del tipo /api/storage/dashboards/images/xxx.jpg son resueltas aquí.
 *
 * Prioridad:
 * 1. Copia local en public/storage/comprobantes/{key}
 * 2. Stream directo desde S3 con credenciales del servidor
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const params = await context.params;
  const key = params.key?.join("/");

  if (!key) {
    return NextResponse.json({ error: "Clave no especificada" }, { status: 400 });
  }

  // Inferir Content-Type desde la extensión
  const ext = path.extname(key).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
  };
  const contentType = contentTypeMap[ext] || "application/octet-stream";

  // 1. Intentar servir desde copia local (public/storage/comprobantes/{key})
  const localPath = path.join(process.cwd(), "public", "storage", "comprobantes", key);
  if (fs.existsSync(localPath)) {
    try {
      const buffer = fs.readFileSync(localPath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      console.warn(`[api/storage] Error al leer copia local "${localPath}":`, err);
    }
  }

  // 2. Intentar descargar desde S3 remoto
  const { bucket, endpoint, accessKey, secretKey, region } = getS3Config();
  const hasCredentials = Boolean(
    accessKey &&
    secretKey &&
    !accessKey.includes("TU_KEY") &&
    endpoint &&
    endpoint.startsWith("http")
  );

  if (hasCredentials) {
    try {
      const s3 = new S3Client({
        endpoint,
        region: region || "us-east-2",
        credentials: {
          accessKeyId: accessKey!,
          secretAccessKey: secretKey!,
        },
        forcePathStyle: true,
      });

      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const s3Response = await s3.send(command);

      if (s3Response.Body) {
        const chunks: Uint8Array[] = [];
        const stream = s3Response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Guardar copia local para siguientes requests
        try {
          const localDir = path.dirname(localPath);
          fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(localPath, buffer);
        } catch {
          // No es crítico si falla el cache local
        }

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    } catch (s3Err: any) {
      console.warn(`[api/storage] Error al descargar de S3 key="${key}":`, s3Err?.message);
    }
  }

  return NextResponse.json(
    { error: "Imagen no encontrada", key },
    { status: 404 }
  );
}
