import type {
  SunatBoletaData,
  SunatLiquidacionCompraData,
  SunatSendResult,
  ParsedSupplierInvoice,
} from './types';
import { buildBoletaUbl21Xml, buildLiquidacionCompraUbl21Xml } from './ubl/builder';
import { parseSupplierInvoiceXml } from './ubl/parser';
import { signXmlUbl21 } from './crypto/signer';
import { sendBillToSunat, type SunatSoapConfig } from './soap/client';
import { uploadSunatFilesToS3 } from './storage/s3';

export * from './types';
export * from './ubl/builder';
export * from './ubl/parser';
export * from './crypto/signer';
export * from './soap/client';
export * from './storage/s3';

/**
 * Orquestador principal de emisión de Boleta Electrónica UBL 2.1 SUNAT.
 * Ejecuta el ciclo completo serverless:
 * 1. Generación de XML UBL 2.1
 * 2. Firma Digital XMLDSIG en memoria
 * 3. Empaquetado ZIP y envío SOAP a SUNAT Beta (MODDATOS)
 * 4. Extracción de CDR en memoria
 * 5. Almacenamiento simultáneo de XML y CDR en AWS S3
 */
export async function emitirBoletaSunat(
  boletaData: SunatBoletaData,
  customSoapConfig?: Partial<SunatSoapConfig>
): Promise<SunatSendResult> {
  const documentId = `${boletaData.serie}-${String(boletaData.correlativo).padStart(8, '0')}`;
  // Formato oficial de nombre de archivo SUNAT: {RUC}-{TIPO}-{SERIE}-{NUMERO}
  const fileName = `${boletaData.emisor.ruc}-03-${documentId}`;

  // 1. Generación del XML UBL 2.1
  const xmlUnsigned = buildBoletaUbl21Xml(boletaData);

  // 2. Firma Digital XMLDSIG en memoria
  const xmlSigned = signXmlUbl21(xmlUnsigned, documentId);

  // 3. Envío SOAP a SUNAT Beta
  const soapConfig: SunatSoapConfig = {
    ruc: boletaData.emisor.ruc,
    usuario: process.env.SUNAT_USER || 'MODDATOS',
    clave: process.env.SUNAT_PASSWORD || 'moddatos',
    endpointUrl: process.env.SUNAT_ENDPOINT || 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    ...customSoapConfig,
  };

  const cdr = await sendBillToSunat(soapConfig, fileName, xmlSigned);

  // 4. Subida directa a AWS S3 (sin escribir en disco)
  const s3Result = await uploadSunatFilesToS3(fileName, xmlSigned, cdr.cdrZipBuffer);

  return {
    fileName,
    xmlSigned,
    cdr,
    s3XmlUrl: s3Result.xmlUrl,
    s3CdrUrl: s3Result.cdrUrl,
  };
}

/**
 * Emite una Liquidación de Compra Electrónica (Tipo 04 - UBL 2.1) a SUNAT.
 * Utilizada cuando la pollería compra insumos primarios a personas naturales sin RUC/negocio.
 * Realiza el ciclo completo: Generación XML -> Firma XMLDSIG -> Envío SOAP -> CDR -> S3.
 */
export async function emitirLiquidacionCompraSunat(
  liquidacionData: SunatLiquidacionCompraData,
  customSoapConfig?: Partial<SunatSoapConfig>
): Promise<SunatSendResult> {
  const documentId = `${liquidacionData.serie}-${String(liquidacionData.correlativo).padStart(8, '0')}`;
  // Formato oficial SUNAT: {RUC}-04-{SERIE}-{NUMERO}
  const fileName = `${liquidacionData.emisor.ruc}-04-${documentId}`;

  // 1. Generación del XML UBL 2.1 Tipo 04
  const xmlUnsigned = buildLiquidacionCompraUbl21Xml(liquidacionData);

  // 2. Firma Digital XMLDSIG en memoria
  const xmlSigned = signXmlUbl21(xmlUnsigned, documentId);

  // 3. Envío SOAP a SUNAT Beta
  const soapConfig: SunatSoapConfig = {
    ruc: liquidacionData.emisor.ruc,
    usuario: process.env.SUNAT_USER || 'MODDATOS',
    clave: process.env.SUNAT_PASSWORD || 'moddatos',
    endpointUrl: process.env.SUNAT_ENDPOINT || 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    ...customSoapConfig,
  };

  const cdr = await sendBillToSunat(soapConfig, fileName, xmlSigned);

  // 4. Subida a AWS S3 (sin escribir en disco)
  const s3Result = await uploadSunatFilesToS3(fileName, xmlSigned, cdr.cdrZipBuffer);

  return {
    fileName,
    xmlSigned,
    cdr,
    s3XmlUrl: s3Result.xmlUrl,
    s3CdrUrl: s3Result.cdrUrl,
  };
}

/**
 * Procesa y valida una Factura Electrónica de Proveedor (UBL 2.1 - Tipo 01).
 * Valida la presencia de la firma XMLDSIG y extrae la cabecera, impuestos e ítems comprados.
 * Opcionalmente archiva el XML original del proveedor en S3.
 */
export async function procesarFacturaCompraElectronica(
  xmlContent: string,
  options?: { uploadToS3?: boolean }
): Promise<ParsedSupplierInvoice & { s3Url?: string }> {
  // 1. Parseo y extracción en memoria
  const parsed = parseSupplierInvoiceXml(xmlContent);

  let s3Url: string | undefined;

  // 2. Archivo en S3 si se solicita
  if (options?.uploadToS3) {
    const fileName = `${parsed.proveedorRuc}-${parsed.tipoDocumento}-${parsed.serie}-${parsed.correlativo}`;
    const s3Result = await uploadSunatFilesToS3(fileName, xmlContent);
    s3Url = s3Result.xmlUrl;
  }

  return {
    ...parsed,
    s3Url,
  };
}

