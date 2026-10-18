import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface SunatS3UploadResult {
  xmlUrl: string;
  cdrUrl?: string;
  xmlKey: string;
  cdrKey?: string;
  bucket: string;
  isSimulated?: boolean;
}

/**
 * Cliente S3 Serverless en memoria.
 * Compatible con AWS S3, Cloudflare R2 y Neon Object Storage en Vercel.
 */
function getS3Client(): { s3: S3Client | null; bucket: string; endpoint?: string; isConfigured: boolean } {
  const accessKey =
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID;

  const secretKey =
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY;

  const bucket =
    process.env.AWS_S3_BUCKET ||
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.NEON_S3_BUCKET ||
    'comprobantes';

  const region =
    process.env.AWS_REGION ||
    process.env.S3_REGION ||
    'us-east-1';

  const endpoint =
    process.env.AWS_ENDPOINT_URL_S3 ||
    process.env.AWS_ENDPOINT_URL ||
    process.env.AWS_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    process.env.NEON_S3_ENDPOINT;

  if (!accessKey || !secretKey) {
    return { s3: null, bucket, endpoint, isConfigured: false };
  }

  const s3 = new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    // forcePathStyle: true evita que el SDK anteponga el bucket como subdominio (bucket.host.domain),
    // lo que rompe los certificados SSL wildcard de proveedores como Neon Object Storage (*.storage.c-7.aws.neon.tech)
    forcePathStyle: true,
  });

  return { s3, bucket, endpoint, isConfigured: true };
}

/**
 * Sube el XML firmado y el CDR de SUNAT a AWS S3 100% en memoria.
 * No realiza ninguna lectura ni escritura en el disco local de Vercel.
 *
 * @param fileName Nombre oficial SUNAT (ej: 20000000001-03-B001-00000124)
 * @param xmlSigned Contenido del XML firmado
 * @param cdrZipBuffer Buffer del ZIP de respuesta (CDR)
 */
export async function uploadSunatFilesToS3(
  fileName: string,
  xmlSigned: string,
  cdrZipBuffer?: Buffer
): Promise<SunatS3UploadResult> {
  const { s3, bucket, endpoint, isConfigured } = getS3Client();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const xmlKey = `sunat/boletas/${year}/${month}/${fileName}.xml`;
  const cdrKey = `sunat/cdr/${year}/${month}/R-${fileName}.zip`;
  const baseUrl = endpoint ? `${endpoint}/${bucket}` : `https://${bucket}.s3.amazonaws.com`;

  // MODO SIMULADO / LOCAL si no hay credenciales S3 configuradas en el entorno
  if (!isConfigured || !s3) {
    return {
      xmlUrl: `${baseUrl}/${xmlKey}`,
      cdrUrl: cdrZipBuffer ? `${baseUrl}/${cdrKey}` : undefined,
      xmlKey,
      cdrKey: cdrZipBuffer ? cdrKey : undefined,
      bucket,
      isSimulated: true,
    };
  }

  // MODO SERVERLESS REAL: Envío en memoria con PutObjectCommand y fallback seguro
  try {
    const uploadPromises: Promise<any>[] = [];

    // 1. Subir XML Firmado en memoria (Buffer UTF-8)
    uploadPromises.push(
      s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: xmlKey,
          Body: Buffer.from(xmlSigned, 'utf8'),
          ContentType: 'application/xml',
        })
      )
    );

    // 2. Subir CDR ZIP en memoria si existe
    if (cdrZipBuffer && cdrZipBuffer.length > 0) {
      uploadPromises.push(
        s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: cdrKey,
            Body: cdrZipBuffer,
            ContentType: 'application/zip',
          })
        )
      );
    }

    await Promise.all(uploadPromises);

    return {
      xmlUrl: `${baseUrl}/${xmlKey}`,
      cdrUrl: cdrZipBuffer ? `${baseUrl}/${cdrKey}` : undefined,
      xmlKey,
      cdrKey: cdrZipBuffer ? cdrKey : undefined,
      bucket,
      isSimulated: false,
    };
  } catch (error: any) {
    console.warn(`[SUNAT S3 Storage] Aviso al subir a S3 remoto: ${error?.message || error}. Utilizando URL de resguardo.`);
    return {
      xmlUrl: `${baseUrl}/${xmlKey}`,
      cdrUrl: cdrZipBuffer ? `${baseUrl}/${cdrKey}` : undefined,
      xmlKey,
      cdrKey: cdrZipBuffer ? cdrKey : undefined,
      bucket,
      isSimulated: true,
    };
  }
}
