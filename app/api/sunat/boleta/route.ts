import { NextRequest, NextResponse } from 'next/server';
import { emitirBoletaSunat, type SunatBoletaData } from '@/lib/sunat';
import { authorize } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Timeout de función serverless en Vercel

/**
 * Boleta de demostración predeterminada para Pollería
 * (1 Pollo a la brasa familiar con papas y ensalada, IGV 18%)
 */
function getDefaultPolleriaBoleta(): SunatBoletaData {
  const now = new Date();
  const fechaEmision = now.toISOString().split('T')[0];
  const horaEmision = now.toTimeString().split(' ')[0];

  // 1 Pollo a la Brasa = S/ 78.50 (Inc. IGV)
  // Valor sin IGV = 78.50 / 1.18 = 66.5254 -> 66.53
  // IGV = 78.50 - 66.53 = 11.97
  const precioUnitario = 78.50;
  const valorUnitario = 66.53;
  const igvItem = 11.97;
  const total = 78.50;

  return {
    serie: 'B001',
    correlativo: Math.floor(Date.now() / 1000) % 100000000,
    fechaEmision,
    horaEmision,
    moneda: 'PEN',
    emisor: {
      ruc: process.env.SUNAT_RUC || '20000000001',
      razonSocial: 'POLLERIA Y PARRILLAS EL SABOR PERUANO S.A.C.',
      nombreComercial: 'EL SABOR PERUANO',
      direccion: 'AV. LOS POLLOS 123 - LIMA',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'MIRAFLORES',
      ubigeo: '150122',
    },
    cliente: {
      tipoDoc: '1', // 1: DNI
      numDoc: '72345678',
      rznSocial: 'JUAN CARLOS PEREZ GOMEZ',
      direccion: 'JR. LAS PAPAS 456',
    },
    items: [
      {
        id: 1,
        codigo: 'POL-001',
        descripcion: '1 Pollo a la Brasa + Papas Fritas + Ensalada Clásica',
        unidadMedida: 'NIU',
        cantidad: 1,
        precioUnitario,
        valorUnitario,
        igv: igvItem,
        total,
        codigoAfectacionIgv: '10', // Gravado - Operación Onerosa
      },
    ],
    subtotal: valorUnitario,
    igv: igvItem,
    total,
  };
}

/**
 * POST /api/sunat/boleta
 * Emite una boleta electrónica UBL 2.1, la firma con XMLDSIG, la envía a SUNAT Beta vía SOAP
 * y archiva el XML firmado y el CDR en AWS S3.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize("ventas.crear");
  if (!auth.ok) return auth.response;

  try {
    let payload: SunatBoletaData;
    const bodyText = await req.text();

    if (bodyText && bodyText.trim().length > 0) {
      const parsedBody = JSON.parse(bodyText);
      payload = {
        ...getDefaultPolleriaBoleta(),
        ...parsedBody,
      };
    } else {
      payload = getDefaultPolleriaBoleta();
    }

    const resultado = await emitirBoletaSunat(payload);

    return NextResponse.json({
      success: resultado.cdr.success,
      mensaje: resultado.cdr.description,
      codigoSunat: resultado.cdr.code,
      documento: {
        tipo: '03 (Boleta de Venta Electrónica)',
        serie: payload.serie,
        correlativo: payload.correlativo,
        archivo: resultado.fileName,
        total: payload.total,
        moneda: payload.moneda,
        emisor: payload.emisor.razonSocial,
        cliente: payload.cliente.rznSocial,
      },
      s3: {
        xmlUrl: resultado.s3XmlUrl,
        cdrUrl: resultado.s3CdrUrl,
      },
      observaciones: resultado.cdr.notes || [],
      cdrDetalle: {
        codigoRespuesta: resultado.cdr.code,
        descripcion: resultado.cdr.description,
      },
      xmlFirmadoPreview: resultado.xmlSigned.slice(0, 500) + '... (truncado)',
    });
  } catch (error: unknown) {
    console.error('[API SUNAT Boleta] Error en emisión serverless:', error);
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar la boleta electrónica con SUNAT',
        detalle: mensaje,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sunat/boleta
 * Información del servicio de facturación electrónica SUNAT UBL 2.1
 */
export async function GET() {
  const auth = await authorize("ventas.ver");
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    service: 'Microservicio Serverless de Facturación Electrónica SUNAT (UBL 2.1)',
    version: '1.0.0',
    ambiente: process.env.SUNAT_ENDPOINT?.includes('beta') ? 'BETA' : 'PRODUCCION',
    endpointSunat: process.env.SUNAT_ENDPOINT || 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    metodosPermitidos: ['POST', 'GET'],
    ejemploUso: 'Envía un POST a esta ruta con o sin body para emitir una boleta de Pollo a la brasa.',
  });
}
