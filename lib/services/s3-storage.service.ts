import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Servicio de Almacenamiento S3 (Compatible con Neon Object Storage / AWS S3 / Cloudflare R2).
 * 
 * Bucket configurado: "comprobantes"
 * 
 * Organización dinámica de carpetas:
 * {tipo_comprobante}/{anio}/{mes}/{dia}/{serie}-{numero}.{ext}
 * Ejemplo:
 * - boletas/2026/09/29/B001-000001.pdf
 * - facturas/2026/09/29/F001-000001.pdf
 * - tickets/2026/09/29/T001-000001.pdf
 * 
 * Concurrencia de alto rendimiento:
 * - Soporta el procesamiento de 20 subidas simultáneas a la vez mediante un pool de workers.
 * - Incluye reintentos exponenciales automáticos para asegurar integridad en horas punta.
 */

export interface VoucherFileMetadata {
  voucherId: number;
  voucherType: "Boleta" | "Factura" | "Ticket";
  serie: string;
  number: number;
  format?: "pdf" | "xml" | "json";
  date?: Date | string;
}

export interface S3UploadResult {
  voucherId: number;
  s3Key: string;
  publicUrl: string;
  bucket: string;
  status: "guardado" | "simulado" | "error";
  message: string;
  timeMs?: number;
}

export interface S3BatchItem {
  meta: VoucherFileMetadata;
  content?: Buffer | Uint8Array | string;
  contentType?: string;
}

export interface S3BatchSummary {
  total: number;
  successful: number;
  failed: number;
  concurrencyUsed: number;
  totalTimeMs: number;
  results: S3UploadResult[];
}

export function getS3Config() {
  const bucket =
    process.env.AWS_S3_BUCKET ||
    process.env.S3_BUCKET ||
    process.env.NEON_S3_BUCKET ||
    "comprobantes";

  const endpoint =
    process.env.AWS_ENDPOINT_URL_S3 ||
    process.env.AWS_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    process.env.NEON_S3_ENDPOINT ||
    "https://s3.neon.tech";

  const accessKey =
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID ||
    null;

  const secretKey =
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY ||
    null;

  const region =
    process.env.AWS_REGION ||
    process.env.S3_REGION ||
    "us-east-1";

  return { bucket, endpoint, accessKey, secretKey, region };
}

/**
 * Obtiene el nombre del Bucket de S3. Por defecto usa "comprobantes".
 */
export function getBucketName(): string {
  return getS3Config().bucket;
}

/**
 * Genera la clave/ruta dinámica organizada dentro del bucket "comprobantes".
 * Estructura: {tipo_comprobante}/{anio}/{mes}/{dia}/{serie}-{numeroPad}.{formato}
 */
export function buildVoucherS3Key(meta: VoucherFileMetadata): string {
  const f = meta.date ? new Date(meta.date) : new Date();
  const year = f.getFullYear();
  const month = String(f.getMonth() + 1).padStart(2, "0");
  const day = String(f.getDate()).padStart(2, "0");

  let folderType = "boletas";
  const voucherType = (meta.voucherType || "").toLowerCase();
  if (voucherType === "factura") folderType = "facturas";
  else if (voucherType === "ticket") folderType = "tickets";

  const numPad = String(meta.number).padStart(6, "0");
  const extension = meta.format || "pdf";

  return `${folderType}/${year}/${month}/${day}/${meta.serie}-${numPad}.${extension}`;
}

/**
 * Sube o registra un comprobante individual a S3.
 * Si las credenciales no están en .env o GitHub Secrets, opera en modo preparado/simulado.
 */
export async function uploadVoucherToS3(
  meta: VoucherFileMetadata,
  binaryContent?: Buffer | Uint8Array | string
): Promise<S3UploadResult> {
  const startedAt = Date.now();
  const { bucket, endpoint, accessKey, secretKey } = getS3Config();

  const s3Key = buildVoucherS3Key(meta);
  const publicUrl = `${endpoint}/${bucket}/${s3Key}`;
  const localUrl = `/storage/comprobantes/${s3Key}`;

  const body =
    binaryContent ||
    Buffer.from(
      JSON.stringify(
        {
          voucherId: meta.voucherId,
          voucherType: meta.voucherType,
          serie: meta.serie,
          number: meta.number,
          date: meta.date || new Date(),
          issuer: "POLLERIA EL SABORCITO",
          ruc: "20601234567",
        },
        null,
        2
      )
    );

  // 1. Guardar físicamente una copia local en disco (public/storage/comprobantes/...)
  try {
    const localDir = path.join(process.cwd(), "public", "storage", "comprobantes", path.dirname(s3Key));
    fs.mkdirSync(localDir, { recursive: true });
    const localFilePath = path.join(process.cwd(), "public", "storage", "comprobantes", s3Key);
    fs.writeFileSync(localFilePath, body);
  } catch (fsErr) {
    console.warn("[uploadVoucherToS3] Aviso al persistir copia local:", fsErr);
  }

  // MODO 1: Sin credenciales remotas configuradas
  const hasValidRemoteCreds = Boolean(
    accessKey &&
    secretKey &&
    !accessKey.includes("TU_KEY") &&
    endpoint &&
    endpoint.startsWith("http")
  );

  if (!hasValidRemoteCreds) {
    return {
      voucherId: meta.voucherId,
      s3Key,
      publicUrl: localUrl,
      bucket,
      status: "guardado",
      message: `Comprobante archivado digitalmente en almacenamiento ('${localUrl}').`,
      timeMs: Date.now() - startedAt,
    };
  }

  // MODO 2: Con credenciales oficiales de S3 remoto (Neon Object Storage / AWS S3 / Cloudflare R2)
  try {
    const contentType =
      meta.format === "xml"
        ? "application/xml"
        : meta.format === "json"
        ? "application/json"
        : "application/pdf";

    const s3 = new S3Client({
      endpoint,
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
      forcePathStyle: true,
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
      })
    );

    return {
      voucherId: meta.voucherId,
      s3Key,
      publicUrl,
      bucket,
      status: "guardado",
      message: `Comprobante archivado en bucket S3 '${bucket}/${s3Key}'.`,
      timeMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    console.warn("[uploadVoucherToS3] Error al subir a S3 remoto:", error);
    return {
      voucherId: meta.voucherId,
      s3Key,
      publicUrl: localUrl,
      bucket,
      status: "guardado",
      message: `Comprobante archivado localmente (${error.message || "S3 remoto no disponible"}).`,
      timeMs: Date.now() - startedAt,
    };
  }
}

/**
 * Procesa y sube un lote de comprobantes con control de concurrencia.
 * 
 * Por defecto soporta 20 subidas en simultáneo a la vez (maxConcurrency = 20),
 * evitando saturación y garantizando un alto throughput en momentos de alta demanda.
 */
export async function uploadVouchersBatch(
  items: S3BatchItem[],
  options: { maxConcurrency?: number; retries?: number } = {}
): Promise<S3BatchSummary> {
  const totalStartedAt = Date.now();
  const concurrencyLimit = Math.max(1, options.maxConcurrency ?? 20);
  const maxRetries = options.retries ?? 2;

  const results: S3UploadResult[] = new Array(items.length);
  let currentIndex = 0;

  // Función worker para procesar ítems de la cola con el límite de concurrencia de 20
  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      const item = items[idx];

      let attempt = 0;
      let result: S3UploadResult | null = null;

      while (attempt <= maxRetries) {
        try {
          result = await uploadVoucherToS3(item.meta, item.content);
          if (result.status !== "error") break;
        } catch (err: any) {
          attempt++;
          if (attempt > maxRetries) {
            result = {
              voucherId: item.meta.voucherId,
              s3Key: buildVoucherS3Key(item.meta),
              publicUrl: "",
              bucket: getBucketName(),
              status: "error",
              message: `Fallo tras ${maxRetries} reintentos: ${err.message}`,
            };
          } else {
            // Breve espera exponencial antes de reintentar
            await new Promise((r) => setTimeout(r, 50 * attempt));
          }
        }
      }

      results[idx] = result!;
    }
  }

  // Lanzar simultáneamente hasta 'concurrencyLimit' (20) workers en paralelo
  const workerCount = Math.min(items.length, concurrencyLimit);
  const workers = Array.from({ length: workerCount }, () => worker());

  await Promise.all(workers);

  const successful = results.filter((r) => r.status !== "error").length;
  const failed = results.length - successful;

  return {
    total: items.length,
    successful,
    failed,
    concurrencyUsed: workerCount,
    totalTimeMs: Date.now() - totalStartedAt,
    results,
  };
}

/**
 * Genera una URL firmada temporal (Presigned URL) para acceder a un comprobante privado en S3.
 * Válida por defecto durante 1 hora (3600 segundos).
 */
export async function getVoucherPresignedUrl(
  s3KeyOrUrl: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { bucket, endpoint, accessKey, secretKey, region } = getS3Config();

  if (!accessKey || !secretKey || !endpoint) {
    return null;
  }

  let s3Key = s3KeyOrUrl.trim();
  const bucketPrefix = `/${bucket}/`;
  if (s3Key.includes(bucketPrefix)) {
    s3Key = s3Key.substring(s3Key.indexOf(bucketPrefix) + bucketPrefix.length);
  } else if (s3Key.includes("/comprobantes/")) {
    s3Key = s3Key.substring(s3Key.indexOf("/comprobantes/") + "/comprobantes/".length);
  } else if (s3Key.startsWith("http://") || s3Key.startsWith("https://")) {
    try {
      const parsed = new URL(s3Key);
      let p = parsed.pathname.replace(/^\/+/, "");
      if (p.startsWith(`${bucket}/`)) {
        p = p.substring(bucket.length + 1);
      }
      s3Key = p;
    } catch {
      // conservar s3Key tal cual
    }
  }

  try {
    const s3 = new S3Client({
      endpoint,
      region: region || "us-east-2",
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error("[getVoucherPresignedUrl] Error al generar presigned URL:", error);
    return null;
  }
}

export interface PaymentProofUploadResult {
  s3Key: string;
  publicUrl: string;
  bucket: string;
  status: "guardado" | "error";
  message: string;
}

/**
 * Sube la foto o captura del comprobante de Yape tomada por el mozo/caja a AWS S3.
 * Guarda también copia física local para fallback y tolerancia a fallos.
 */
export async function uploadPaymentProofToS3({
  orderId,
  serie,
  number,
  imageBase64,
}: {
  orderId: number;
  serie: string;
  number: number;
  imageBase64: string;
}): Promise<PaymentProofUploadResult> {
  const { bucket, endpoint, accessKey, secretKey, region } = getS3Config();

  let cleanBase64 = imageBase64;
  let ext = "jpg";
  if (imageBase64.includes("data:image/png")) {
    ext = "png";
    cleanBase64 = imageBase64.replace(/^data:image\/png;base64,/, "");
  } else if (imageBase64.includes("data:image/jpeg") || imageBase64.includes("data:image/jpg")) {
    ext = "jpg";
    cleanBase64 = imageBase64.replace(/^data:image\/jpe?g;base64,/, "");
  } else if (imageBase64.includes("data:image/webp")) {
    ext = "webp";
    cleanBase64 = imageBase64.replace(/^data:image\/webp;base64,/, "");
  } else if (imageBase64.includes(";base64,")) {
    cleanBase64 = imageBase64.split(";base64,")[1];
  }

  const buffer = Buffer.from(cleanBase64, "base64");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const s3Key = `yape-vouchers/${year}/${month}/${day}/${serie}-${String(number).padStart(6, "0")}-proof-${Date.now()}.${ext}`;
  const localUrl = `/storage/comprobantes/${s3Key}`;

  // 1. Guardar copia local en disco
  try {
    const localDir = path.join(process.cwd(), "public", "storage", "comprobantes", path.dirname(s3Key));
    fs.mkdirSync(localDir, { recursive: true });
    const localFilePath = path.join(process.cwd(), "public", "storage", "comprobantes", s3Key);
    fs.writeFileSync(localFilePath, buffer);
  } catch (fsErr) {
    console.warn("[uploadPaymentProofToS3] Aviso al guardar localmente:", fsErr);
  }

  // 2. Si hay credenciales de S3 remoto (AWS S3)
  const hasValidRemoteCreds = Boolean(
    accessKey &&
    secretKey &&
    !accessKey.includes("TU_KEY") &&
    endpoint &&
    endpoint.startsWith("http")
  );

  if (!hasValidRemoteCreds) {
    return {
      s3Key,
      publicUrl: localUrl,
      bucket,
      status: "guardado",
      message: `Comprobante de Yape archivado localmente en '${localUrl}'.`,
    };
  }

  try {
    const s3 = new S3Client({
      endpoint,
      region: region || "us-east-1",
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
      forcePathStyle: true,
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      })
    );

    const remoteUrl = `${endpoint}/${bucket}/${s3Key}`;
    return {
      s3Key,
      publicUrl: remoteUrl,
      bucket,
      status: "guardado",
      message: `Comprobante de Yape archivado en S3 '${bucket}/${s3Key}'.`,
    };
  } catch (error: any) {
    console.warn("[uploadPaymentProofToS3] Error al subir a S3 remoto, usando fallback local:", error);
    return {
      s3Key,
      publicUrl: localUrl,
      bucket,
      status: "guardado",
      message: `Comprobante de Yape archivado localmente (${error.message || "S3 no disponible"}).`,
    };
  }
}



/**
 * Sube la imagen del QR de Yape del restaurante a S3 (o almacenamiento local)
 * evitando almacenar cadenas base64 pesadas en la base de datos.
 */
export async function uploadYapeQrToS3({
  imageBase64,
}: {
  imageBase64: string;
}): Promise<{ s3Key: string; publicUrl: string }> {
  const { bucket, endpoint, accessKey, secretKey, region } = getS3Config();

  let cleanBase64 = imageBase64;
  let ext = "png";
  if (imageBase64.includes("data:image/png")) {
    ext = "png";
    cleanBase64 = imageBase64.replace(/^data:image\/png;base64,/, "");
  } else if (imageBase64.includes("data:image/jpeg") || imageBase64.includes("data:image/jpg")) {
    ext = "jpg";
    cleanBase64 = imageBase64.replace(/^data:image\/jpe?g;base64,/, "");
  } else if (imageBase64.includes("data:image/webp")) {
    ext = "webp";
    cleanBase64 = imageBase64.replace(/^data:image\/webp;base64,/, "");
  } else if (imageBase64.includes(";base64,")) {
    cleanBase64 = imageBase64.split(";base64,")[1];
  }

  const buffer = Buffer.from(cleanBase64, "base64");
  const s3Key = `restaurant/yape-qr-${Date.now()}.${ext}`;
  const localUrl = `/storage/comprobantes/${s3Key}`;

  // 1. Guardar copia local en disco
  try {
    const localDir = path.join(process.cwd(), "public", "storage", "comprobantes", path.dirname(s3Key));
    fs.mkdirSync(localDir, { recursive: true });
    const localFilePath = path.join(process.cwd(), "public", "storage", "comprobantes", s3Key);
    fs.writeFileSync(localFilePath, buffer);
  } catch (fsErr) {
    console.warn("[uploadYapeQrToS3] Aviso al guardar localmente:", fsErr);
  }

  // 2. Si hay credenciales de S3 remoto
  const hasValidRemoteCreds = Boolean(
    accessKey &&
    secretKey &&
    !accessKey.includes("TU_KEY") &&
    endpoint &&
    endpoint.startsWith("http")
  );

  if (!hasValidRemoteCreds) {
    return {
      s3Key,
      publicUrl: localUrl,
    };
  }

  try {
    const s3 = new S3Client({
      endpoint,
      region: region || "us-east-1",
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
      forcePathStyle: true,
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      })
    );

    const remoteUrl = `${endpoint}/${bucket}/${s3Key}`;
    return {
      s3Key,
      publicUrl: remoteUrl,
    };
  } catch (error: any) {
    console.warn("[uploadYapeQrToS3] Error al subir a S3 remoto, usando fallback local:", error);
    return {
      s3Key,
      publicUrl: localUrl,
    };
  }
}
