import { NextRequest, NextResponse } from 'next/server';
import { procesarFacturaCompraElectronica } from '@/lib/sunat';
import { authorize } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/sunat/compras/validar-xml
 * Recibe el XML UBL 2.1 de una Factura Electrónica de Proveedor (Tipo 01),
 * valida su estructura y firma digital XMLDSIG, extrae sus ítems y costos,
 * y opcionalmente lo archiva en AWS S3.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize('compras.crear');
  if (!auth.ok) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let xmlContent = '';
    let uploadToS3 = false;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      xmlContent = body.xml || body.xmlContent || '';
      uploadToS3 = Boolean(body.uploadToS3);
    } else {
      // Si se envía directamente como application/xml o text/plain
      xmlContent = await req.text();
      uploadToS3 = req.nextUrl.searchParams.get('s3') === 'true';
    }

    if (!xmlContent || xmlContent.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Debe proporcionar el contenido del archivo XML de la factura del proveedor.',
        },
        { status: 400 }
      );
    }

    const resultado = await procesarFacturaCompraElectronica(xmlContent, { uploadToS3 });

    return NextResponse.json({
      success: true,
      mensaje: resultado.validSignature
        ? 'Factura de compra electrónica UBL 2.1 parseada y verificada exitosamente.'
        : 'Factura parseada, pero no se encontró un nodo de firma digital válido.',
      validoParaSunat: resultado.validSignature,
      comprobante: {
        tipoDocumento: resultado.tipoDocumento,
        serie: resultado.serie,
        correlativo: resultado.correlativo,
        fechaEmision: resultado.fechaEmision,
        moneda: resultado.moneda,
        proveedor: {
          ruc: resultado.proveedorRuc,
          razonSocial: resultado.proveedorRazonSocial,
        },
        adquiriente: {
          ruc: resultado.clienteRuc,
          razonSocial: resultado.clienteRazonSocial,
        },
        totales: {
          subtotal: resultado.subtotal,
          igv: resultado.igv,
          total: resultado.total,
        },
        totalItems: resultado.items.length,
        items: resultado.items,
        s3Url: resultado.s3Url,
      },
    });
  } catch (error: unknown) {
    console.error('[API SUNAT Validar XML Compra] Error al procesar XML de proveedor:', error);
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al parsear o validar el XML de factura de compra',
        detalle: mensaje,
      },
      { status: 500 }
    );
  }
}
