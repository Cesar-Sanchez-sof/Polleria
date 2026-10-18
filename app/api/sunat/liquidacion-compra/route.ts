import { NextRequest, NextResponse } from 'next/server';
import { emitirLiquidacionCompraSunat, type SunatLiquidacionCompraData } from '@/lib/sunat';
import { authorize } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Timeout serverless en Vercel

/**
 * Liquidación de Compra de demostración para la Pollería
 * (Compra de 50 Pollos vivos de granja a campesino/avicultor sin RUC, con retención de Renta 1.5%)
 */
function getDefaultLiquidacionCompra(): SunatLiquidacionCompraData {
  const now = new Date();
  const fechaEmision = now.toISOString().split('T')[0];
  const horaEmision = now.toTimeString().split(' ')[0];

  // 50 Pollos Vivos x S/ 18.00 c/u = S/ 900.00
  // Valor compra sin IGV = S/ 900.00 / 1.18 = 762.71
  // IGV (18%) = S/ 137.29
  // Total = S/ 900.00
  // Retención Renta (1.5%) = S/ 13.50
  // Total a pagar al productor = S/ 900.00 - S/ 13.50 = S/ 886.50
  const subtotal = 762.71;
  const igv = 137.29;
  const total = 900.00;
  const retencionRentaPorcentaje = 1.5;
  const retencionRentaMonto = 13.50;
  const totalPagar = 886.50;

  return {
    serie: 'E001',
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
    vendedor: {
      tipoDoc: '1', // 1: DNI (Persona natural sin negocio)
      numDoc: '40123456',
      rznSocial: 'MAMANI QUISPE PEDRO (PRODUCTOR AGROPECUARIO)',
      direccion: 'VALLE DE CHILLON KM 24 - CARABAYLLO',
    },
    items: [
      {
        id: 1,
        codigo: 'INS-POL-VIVO',
        descripcion: 'Pollo Vivo de Granja en Pie (Peso Promedio 2.4 kg)',
        unidadMedida: 'KGM',
        cantidad: 50,
        precioUnitario: 18.00,
        valorUnitario: 15.2542,
        igv: 2.7458,
        total: 900.00,
        codigoAfectacionIgv: '10', // Gravado - Operación Onerosa
      },
    ],
    subtotal,
    igv,
    retencionRentaPorcentaje,
    retencionRentaMonto,
    total,
    totalPagar,
  };
}

/**
 * POST /api/sunat/liquidacion-compra
 * Emite una Liquidación de Compra Electrónica UBL 2.1 (Tipo 04) a SUNAT y archiva en AWS S3.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize('compras.crear');
  if (!auth.ok) return auth.response;

  try {
    let payload: SunatLiquidacionCompraData;
    const bodyText = await req.text();

    if (bodyText && bodyText.trim().length > 0) {
      const parsedBody = JSON.parse(bodyText);
      payload = {
        ...getDefaultLiquidacionCompra(),
        ...parsedBody,
      };
    } else {
      payload = getDefaultLiquidacionCompra();
    }

    const resultado = await emitirLiquidacionCompraSunat(payload);

    return NextResponse.json({
      success: resultado.cdr.success,
      mensaje: resultado.cdr.description,
      codigoSunat: resultado.cdr.code,
      documento: {
        tipo: '04 (Liquidación de Compra Electrónica)',
        serie: payload.serie,
        correlativo: payload.correlativo,
        archivo: resultado.fileName,
        adquiriente: payload.emisor.razonSocial,
        vendedor: payload.vendedor.rznSocial,
        totalCompra: payload.total,
        retencionRenta: payload.retencionRentaMonto,
        totalNetoPagado: payload.totalPagar,
        moneda: payload.moneda,
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
    });
  } catch (error: unknown) {
    console.error('[API SUNAT Liquidacion Compra] Error en emisión serverless:', error);
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar la liquidación de compra electrónica con SUNAT',
        detalle: mensaje,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sunat/liquidacion-compra
 * Información y especificaciones del servicio de liquidaciones de compra
 */
export async function GET() {
  const auth = await authorize('compras.ver');
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    service: 'Microservicio Serverless de Liquidación de Compra Electrónica SUNAT (UBL 2.1 - Tipo 04)',
    version: '1.0.0',
    ambiente: process.env.SUNAT_ENDPOINT?.includes('beta') ? 'BETA' : 'PRODUCCION',
    endpointSunat: process.env.SUNAT_ENDPOINT || 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    metodosPermitidos: ['POST', 'GET'],
    descripcion: 'Emite comprobantes Tipo 04 para adquisición de insumos a productores agropecuarios sin RUC con retención de Renta.',
  });
}
