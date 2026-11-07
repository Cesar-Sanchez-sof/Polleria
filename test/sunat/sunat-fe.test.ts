import { describe, expect, it } from 'vitest';
import {
  buildBoletaUbl21Xml,
  signXmlUbl21,
  packageXmlToZipInMemory,
  buildSendBillSoapEnvelope,
  parseCdrZipInMemory,
  generateMockCdr,
  emitirBoletaSunat,
  type SunatBoletaData,
} from '@/lib/sunat';

describe('Microservicio de Facturación Electrónica SUNAT (UBL 2.1)', () => {
  const sampleBoletaData: SunatBoletaData = {
    serie: 'B001',
    correlativo: 105,
    fechaEmision: '2026-10-17',
    horaEmision: '13:30:00',
    moneda: 'PEN',
    emisor: {
      ruc: '20000000001',
      razonSocial: 'POLLERIA Y PARRILLAS EL SABOR S.A.C.',
      direccion: 'AV. PRINCIPAL 100',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'MIRAFLORES',
      ubigeo: '150122',
    },
    cliente: {
      tipoDoc: '1',
      numDoc: '72345678',
      rznSocial: 'JUAN PEREZ',
    },
    items: [
      {
        id: 1,
        codigo: 'POL-01',
        descripcion: '1 Pollo a la Brasa + Papas + Ensalada',
        unidadMedida: 'NIU',
        cantidad: 1,
        precioUnitario: 78.50,
        valorUnitario: 66.53,
        igv: 11.97,
        total: 78.50,
        codigoAfectacionIgv: '10',
      },
    ],
    subtotal: 66.53,
    igv: 11.97,
    total: 78.50,
  };

  it('1. Debe generar un XML UBL 2.1 válido con xmlbuilder2 y estructura SUNAT', () => {
    const xml = buildBoletaUbl21Xml(sampleBoletaData);

    expect(xml).toContain('<Invoice');
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>2.0</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ID>B001-00000105</cbc:ID>');
    expect(xml).toContain('<cbc:InvoiceTypeCode listID="0101">03</cbc:InvoiceTypeCode>');
    expect(xml).toContain('POLLERIA Y PARRILLAS EL SABOR S.A.C.');
    expect(xml).toContain('1 Pollo a la Brasa + Papas + Ensalada');
    expect(xml).toContain('<cbc:TaxAmount currencyID="PEN">11.97</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">78.50</cbc:PayableAmount>');
    expect(xml).toContain('<ext:ExtensionContent/>');
  });

  it('2. Debe firmar el XML con XMLDSIG en memoria e inyectar el nodo <ds:Signature>', () => {
    const xmlUnsigned = buildBoletaUbl21Xml(sampleBoletaData);
    const xmlSigned = signXmlUbl21(xmlUnsigned, 'B001-00000105');

    expect(xmlSigned).toContain('<ds:Signature');
    expect(xmlSigned).toContain('Id="Signature-B001-00000105"');
    expect(xmlSigned).toContain('<ds:SignedInfo');
    expect(xmlSigned).toContain('<ds:DigestValue>');
    expect(xmlSigned).toContain('<ds:SignatureValue>');
    expect(xmlSigned).toContain('<ds:X509Certificate>');
    expect(xmlSigned).toContain('http://www.w3.org/2000/09/xmldsig#enveloped-signature');
  });

  it('3. Debe empaquetar el XML firmado en un ZIP en memoria sin tocar disco', () => {
    const xmlSigned = signXmlUbl21(buildBoletaUbl21Xml(sampleBoletaData), 'B001-00000105');
    const { zipBuffer, base64Zip } = packageXmlToZipInMemory('20000000001-03-B001-00000105', xmlSigned);

    expect(Buffer.isBuffer(zipBuffer)).toBe(true);
    expect(zipBuffer.length).toBeGreaterThan(100);
    // Firma mágica de archivo ZIP: PK\x03\x04 (0x50, 0x4b, 0x03, 0x04)
    expect(zipBuffer[0]).toBe(0x50);
    expect(zipBuffer[1]).toBe(0x4b);
    expect(typeof base64Zip).toBe('string');
    expect(base64Zip.length).toBeGreaterThan(50);
  });

  it('4. Debe construir el Envelope SOAP con credenciales WS-Security MODDATOS', () => {
    const envelope = buildSendBillSoapEnvelope(
      { ruc: '20000000001', usuario: 'MODDATOS', clave: 'moddatos' },
      '20000000001-03-B001-00000105',
      'VEVTVF9aSVBfQ09OVEVOVA=='
    );

    expect(envelope).toContain('<soapenv:Envelope');
    expect(envelope).toContain('<wsse:Username>20000000001MODDATOS</wsse:Username>');
    expect(envelope).toContain('<wsse:Password>moddatos</wsse:Password>');
    expect(envelope).toContain('<fileName>20000000001-03-B001-00000105.zip</fileName>');
    expect(envelope).toContain('<contentFile>VEVTVF9aSVBfQ09OVEVOVA==</contentFile>');
  });

  it('5. Debe procesar y descomprimir un CDR en memoria extrayendo código 0 (Aceptado)', () => {
    const mockCdr = generateMockCdr('B001-00000105');
    expect(mockCdr.success).toBe(true);
    expect(mockCdr.code).toBe('0');
    expect(mockCdr.cdrZipBuffer).toBeDefined();

    const parsed = parseCdrZipInMemory(mockCdr.cdrZipBuffer!);
    expect(parsed.code).toBe('0');
    expect(parsed.description).toContain('ha sido aceptada exitosamente');
  });

  it('6. Debe ejecutar el ciclo de vida completo de emisión serverless', async () => {
    const result = await emitirBoletaSunat(sampleBoletaData);

    expect(result.fileName).toBe('20000000001-03-B001-00000105');
    expect(result.xmlSigned).toContain('<ds:Signature');
    expect(result.cdr).toBeDefined();
    expect(result.cdr.code).toBe('0');
    expect(result.s3XmlUrl).toContain('sunat/boletas/');
    expect(result.s3XmlUrl).toContain('20000000001-03-B001-00000105.xml');
    expect(result.s3CdrUrl).toContain('sunat/cdr/');
  });
});
