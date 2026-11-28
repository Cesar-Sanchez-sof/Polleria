import { describe, expect, it } from 'vitest';
import {
  buildLiquidacionCompraUbl21Xml,
  signXmlUbl21,
  emitirLiquidacionCompraSunat,
  parseSupplierInvoiceXml,
  procesarFacturaCompraElectronica,
  buildBoletaUbl21Xml,
  type SunatLiquidacionCompraData,
} from '@/lib/sunat';

describe('Facturación Electrónica en Compras SUNAT (UBL 2.1)', () => {
  const sampleLiquidacionData: SunatLiquidacionCompraData = {
    serie: 'E001',
    correlativo: 42,
    fechaEmision: '2026-10-17',
    horaEmision: '15:30:00',
    moneda: 'PEN',
    emisor: {
      ruc: '20000000001',
      razonSocial: 'POLLERIA EL SABOR PERUANO S.A.C.',
      direccion: 'AV. LOS POLLOS 123',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'MIRAFLORES',
      ubigeo: '150122',
    },
    vendedor: {
      tipoDoc: '1', // DNI
      numDoc: '40123456',
      rznSocial: 'PEDRO MAMANI (AVICULTOR ARTESANAL)',
      direccion: 'VALLE DE CHILLON KM 24',
    },
    items: [
      {
        id: 1,
        codigo: 'INS-POL-01',
        descripcion: 'Pollo Vivo en Pie de Granja',
        unidadMedida: 'KGM',
        cantidad: 100,
        precioUnitario: 10.00,
        valorUnitario: 8.4746,
        igv: 1.5254,
        total: 1000.00,
        codigoAfectacionIgv: '10',
      },
    ],
    subtotal: 847.46,
    igv: 152.54,
    retencionRentaPorcentaje: 1.5,
    retencionRentaMonto: 15.00,
    total: 1000.00,
    totalPagar: 985.00,
  };

  it('1. Debe generar un XML UBL 2.1 de Liquidación de Compra (Tipo 04) con retenciones', () => {
    const xml = buildLiquidacionCompraUbl21Xml(sampleLiquidacionData);

    expect(xml).toContain('<Invoice');
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:ID>E001-00000042</cbc:ID>');
    expect(xml).toContain('<cbc:InvoiceTypeCode listID="0101">04</cbc:InvoiceTypeCode>');
    expect(xml).toContain('POLLERIA EL SABOR PERUANO S.A.C.');
    expect(xml).toContain('PEDRO MAMANI (AVICULTOR ARTESANAL)');
    expect(xml).toContain('Pollo Vivo en Pie de Granja');
    expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">985.00</cbc:PayableAmount>');
  });

  it('2. Debe firmar la Liquidación de Compra con XMLDSIG en memoria', () => {
    const xmlUnsigned = buildLiquidacionCompraUbl21Xml(sampleLiquidacionData);
    const xmlSigned = signXmlUbl21(xmlUnsigned, 'E001-00000042');

    expect(xmlSigned).toContain('<ds:Signature');
    expect(xmlSigned).toContain('Id="Signature-E001-00000042"');
    expect(xmlSigned).toContain('<ds:SignedInfo');
    expect(xmlSigned).toContain('<ds:DigestValue>');
    expect(xmlSigned).toContain('<ds:SignatureValue>');
  });

  it('3. Debe ejecutar el ciclo serverless completo de Liquidación de Compra a SUNAT y S3', async () => {
    const result = await emitirLiquidacionCompraSunat(sampleLiquidacionData);

    expect(result.fileName).toBe('20000000001-04-E001-00000042');
    expect(result.cdr.code).toBe('0');
    expect(result.s3XmlUrl).toContain('sunat/boletas/');
    expect(result.s3XmlUrl).toContain('20000000001-04-E001-00000042.xml');
    expect(result.s3CdrUrl).toContain('sunat/cdr/');
  });

  it('4. Debe parsear y validar una Factura Electrónica de Proveedor UBL 2.1 extrayendo datos e ítems', () => {
    // Generamos un XML firmado simulando una factura del proveedor San Fernando
    const supplierInvoiceData = {
      serie: 'F001',
      correlativo: 9812,
      fechaEmision: '2026-10-15',
      horaEmision: '09:00:00',
      moneda: 'PEN',
      emisor: {
        ruc: '20100154308',
        razonSocial: 'AVICOLA SAN FERNANDO S.A.',
        direccion: 'AV. REPUBLICA DE PANAMA 2461',
        departamento: 'LIMA',
        provincia: 'LIMA',
        distrito: 'SURQUILLO',
        ubigeo: '150134',
      },
      cliente: {
        tipoDoc: '6' as const,
        numDoc: '20000000001',
        rznSocial: 'POLLERIA EL SABOR PERUANO S.A.C.',
      },
      items: [
        {
          id: 1,
          codigo: 'POLLO-BENEFICIADO',
          descripcion: 'Pollo Eviscerado Grado A 2.2kg',
          unidadMedida: 'KGM',
          cantidad: 200,
          precioUnitario: 12.00,
          valorUnitario: 10.1695,
          igv: 1.8305,
          total: 2400.00,
          codigoAfectacionIgv: '10',
        },
        {
          id: 2,
          codigo: 'PAPA-CANCHAN',
          descripcion: 'Saco de Papa Canchan 50kg',
          unidadMedida: 'KGM',
          cantidad: 10,
          precioUnitario: 80.00,
          valorUnitario: 67.7966,
          igv: 12.2034,
          total: 800.00,
          codigoAfectacionIgv: '10',
        },
      ],
      subtotal: 2711.86,
      igv: 488.14,
      total: 3200.00,
    };

    const rawXml = buildBoletaUbl21Xml(supplierInvoiceData as any);
    const signedXml = signXmlUbl21(rawXml, 'F001-00009812');

    const parsed = parseSupplierInvoiceXml(signedXml);

    expect(parsed.validSignature).toBe(true);
    expect(parsed.serie).toBe('F001');
    expect(parsed.correlativo).toBe('00009812');
    expect(parsed.proveedorRuc).toBe('20100154308');
    expect(parsed.proveedorRazonSocial).toContain('SAN FERNANDO');
    expect(parsed.clienteRuc).toBe('20000000001');
    expect(parsed.total).toBe(3200.00);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].descripcion).toContain('Pollo Eviscerado');
    expect(parsed.items[0].cantidad).toBe(200);
    expect(parsed.items[1].descripcion).toContain('Papa Canchan');
  });

  it('5. Debe procesar la Factura de Proveedor con resguardo en S3', async () => {
    const rawXml = buildBoletaUbl21Xml({
      serie: 'F002',
      correlativo: 55,
      fechaEmision: '2026-10-16',
      horaEmision: '10:00:00',
      moneda: 'PEN',
      emisor: {
        ruc: '20555666777',
        razonSocial: 'DISTRIBUIDORA DE BEBIDAS S.A.C.',
        direccion: 'CALLE COMERCIO 123',
        departamento: 'LIMA',
        provincia: 'LIMA',
        distrito: 'ATE',
        ubigeo: '150103',
      },
      cliente: {
        tipoDoc: '6',
        numDoc: '20000000001',
        rznSocial: 'POLLERIA EL SABOR PERUANO S.A.C.',
      },
      items: [
        {
          id: 1,
          codigo: 'INC-15L',
          descripcion: 'Inca Kola 1.5L x 12 unidades',
          unidadMedida: 'NIU',
          cantidad: 20,
          precioUnitario: 50.00,
          valorUnitario: 42.37,
          igv: 7.63,
          total: 1000.00,
        },
      ],
      subtotal: 847.46,
      igv: 152.54,
      total: 1000.00,
    } as any);

    const signedXml = signXmlUbl21(rawXml, 'F002-00000055');
    const result = await procesarFacturaCompraElectronica(signedXml, { uploadToS3: true });

    expect(result.validSignature).toBe(true);
    expect(result.proveedorRuc).toBe('20555666777');
    expect(result.s3Url).toBeDefined();
    expect(result.s3Url).toContain('20555666777');
  });
});
