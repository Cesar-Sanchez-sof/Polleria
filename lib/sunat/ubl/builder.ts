import { create } from 'xmlbuilder2';
import type { SunatBoletaData, SunatLiquidacionCompraData } from '../types';

/**
 * Generador de XML UBL 2.1 para Boletas de Venta Electrónica (Tipo 03) SUNAT.
 * Cumple con los catálogos y especificaciones de la Guía XML UBL 2.1 de SUNAT.
 */
export function buildBoletaUbl21Xml(data: SunatBoletaData): string {
  const documentId = `${data.serie}-${String(data.correlativo).padStart(8, '0')}`;
  const subtotalFormatted = data.subtotal.toFixed(2);
  const igvFormatted = data.igv.toFixed(2);
  const totalFormatted = data.total.toFixed(2);

  const doc = create({ version: '1.0', encoding: 'ISO-8859-1', standalone: false })
    .ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'xmlns:qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
      'xmlns:udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
    })
    // 1. Contenedor de Extensiones UBL para la Firma Digital XMLDSIG
    .ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
        .ele('ext:ExtensionContent')
        .up()
      .up()
    .up()
    // 2. Versión de UBL y Estándar SUNAT
    .ele('cbc:UBLVersionID').txt('2.1').up()
    .ele('cbc:CustomizationID').txt('2.0').up()
    // 3. Identificador de Comprobante (Serie-Correlativo)
    .ele('cbc:ID').txt(documentId).up()
    .ele('cbc:IssueDate').txt(data.fechaEmision).up()
    .ele('cbc:IssueTime').txt(data.horaEmision).up()
    // 4. Tipo de Documento: '03' = Boleta de Venta (Catálogo 01), 0101 = Venta Interna (Catálogo 51)
    .ele('cbc:InvoiceTypeCode', { listID: '0101' }).txt('03').up()
    .ele('cbc:DocumentCurrencyCode').txt(data.moneda || 'PEN').up()
    // 5. Firma Digital Metadata
    .ele('cac:Signature')
      .ele('cbc:ID').txt(documentId).up()
      .ele('cac:SignatoryParty')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID').txt(data.emisor.ruc).up()
        .up()
        .ele('cac:PartyName')
          .ele('cbc:Name').txt(data.emisor.razonSocial).up()
        .up()
      .up()
      .ele('cac:DigitalSignatureAttachment')
        .ele('cac:ExternalReference')
          .ele('cbc:URI').txt(`#Signature-${documentId}`).up()
        .up()
      .up()
    .up()
    // 6. Datos del Emisor (Pollería / Restaurante)
    .ele('cac:AccountingSupplierParty')
      .ele('cac:Party')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', { schemeID: '6' }).txt(data.emisor.ruc).up()
        .up()
        .ele('cac:PartyName')
          .ele('cbc:Name').txt(data.emisor.nombreComercial || data.emisor.razonSocial).up()
        .up()
        .ele('cac:PartyLegalEntity')
          .ele('cbc:RegistrationName').txt(data.emisor.razonSocial).up()
          .ele('cac:RegistrationAddress')
            .ele('cbc:ID').txt(data.emisor.ubigeo).up()
            .ele('cbc:AddressTypeCode').txt('0000').up()
            .ele('cac:AddressLine')
              .ele('cbc:Line').txt(data.emisor.direccion).up()
            .up()
            .ele('cbc:CityName').txt(data.emisor.provincia).up()
            .ele('cbc:CountrySubentity').txt(data.emisor.departamento).up()
            .ele('cbc:District').txt(data.emisor.distrito).up()
            .ele('cac:Country')
              .ele('cbc:IdentificationCode').txt('PE').up()
            .up()
          .up()
        .up()
      .up()
    .up()
    // 7. Datos del Cliente / Receptor
    .ele('cac:AccountingCustomerParty')
      .ele('cac:Party')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', { schemeID: data.cliente.tipoDoc }).txt(data.cliente.numDoc).up()
        .up()
        .ele('cac:PartyLegalEntity')
          .ele('cbc:RegistrationName').txt(data.cliente.rznSocial).up()
        .up()
      .up()
    .up()
    // 8. Totales de Impuestos (IGV 18%)
    .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(igvFormatted).up()
      .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: data.moneda }).txt(subtotalFormatted).up()
        .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(igvFormatted).up()
        .ele('cac:TaxCategory')
          .ele('cac:TaxScheme')
            .ele('cbc:ID').txt('1000').up()
            .ele('cbc:Name').txt('IGV').up()
            .ele('cbc:TaxTypeCode').txt('VAT').up()
          .up()
        .up()
      .up()
    .up()
    // 9. Total Monetario Legal
    .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: data.moneda }).txt(subtotalFormatted).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: data.moneda }).txt(totalFormatted).up()
      .ele('cbc:PayableAmount', { currencyID: data.moneda }).txt(totalFormatted).up()
    .up();

  // 10. Líneas de Detalle de la Boleta (Ítems)
  data.items.forEach((item, index) => {
    const itemSubtotal = (item.valorUnitario * item.cantidad).toFixed(2);
    const itemIgv = (item.igv).toFixed(2);

    doc.ele('cac:InvoiceLine')
      .ele('cbc:ID').txt(String(index + 1)).up()
      .ele('cbc:InvoicedQuantity', { unitCode: item.unidadMedida || 'NIU' }).txt(item.cantidad.toString()).up()
      .ele('cbc:LineExtensionAmount', { currencyID: data.moneda }).txt(itemSubtotal).up()
      .ele('cac:PricingReference')
        .ele('cac:AlternativeConditionPrice')
          .ele('cbc:PriceAmount', { currencyID: data.moneda }).txt(item.precioUnitario.toFixed(2)).up()
          .ele('cbc:PriceTypeCode').txt('01').up() // 01 = Precio unitario incluye IGV
        .up()
      .up()
      .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(itemIgv).up()
        .ele('cac:TaxSubtotal')
          .ele('cbc:TaxableAmount', { currencyID: data.moneda }).txt(itemSubtotal).up()
          .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(itemIgv).up()
          .ele('cac:TaxCategory')
            .ele('cbc:Percent').txt('18.00').up()
            .ele('cbc:TaxExemptionReasonCode').txt(item.codigoAfectacionIgv || '10').up() // 10 = Gravado - Operación Onerosa
            .ele('cac:TaxScheme')
              .ele('cbc:ID').txt('1000').up()
              .ele('cbc:Name').txt('IGV').up()
              .ele('cbc:TaxTypeCode').txt('VAT').up()
            .up()
          .up()
        .up()
      .up()
      .ele('cac:Item')
        .ele('cbc:Description').txt(item.descripcion).up()
        .ele('cac:SellersItemIdentification')
          .ele('cbc:ID').txt(item.codigo).up()
        .up()
      .up()
      .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: data.moneda }).txt(item.valorUnitario.toFixed(2)).up()
      .up()
    .up();
  });

  return doc.end({ prettyPrint: true });
}

/**
 * Generador de XML UBL 2.1 para Liquidación de Compra Electrónica (Tipo 04) SUNAT.
 * Emitida por la Pollería al comprar insumos a personas naturales sin RUC/negocio.
 */
export function buildLiquidacionCompraUbl21Xml(data: SunatLiquidacionCompraData): string {
  const documentId = `${data.serie}-${String(data.correlativo).padStart(8, '0')}`;
  const subtotalFormatted = data.subtotal.toFixed(2);
  const igvFormatted = data.igv.toFixed(2);
  const totalFormatted = data.total.toFixed(2);
  const totalPagarFormatted = data.totalPagar.toFixed(2);
  const retencionMonto = data.retencionRentaMonto ? data.retencionRentaMonto.toFixed(2) : '0.00';

  const doc = create({ version: '1.0', encoding: 'ISO-8859-1', standalone: false })
    .ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'xmlns:qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
      'xmlns:udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
    })
    // 1. Contenedor de Extensiones UBL para la Firma Digital XMLDSIG
    .ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
        .ele('ext:ExtensionContent')
        .up()
      .up()
    .up()
    // 2. Versión de UBL y Estándar SUNAT
    .ele('cbc:UBLVersionID').txt('2.1').up()
    .ele('cbc:CustomizationID').txt('2.0').up()
    // 3. Identificador de Comprobante (Serie-Correlativo)
    .ele('cbc:ID').txt(documentId).up()
    .ele('cbc:IssueDate').txt(data.fechaEmision).up()
    .ele('cbc:IssueTime').txt(data.horaEmision).up()
    // 4. Tipo de Documento: '04' = Liquidación de Compra Electrónica (Catálogo 01)
    .ele('cbc:InvoiceTypeCode', { listID: '0101' }).txt('04').up()
    .ele('cbc:DocumentCurrencyCode').txt(data.moneda || 'PEN').up()
    // 5. Firma Digital Metadata
    .ele('cac:Signature')
      .ele('cbc:ID').txt(documentId).up()
      .ele('cac:SignatoryParty')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID').txt(data.emisor.ruc).up()
        .up()
        .ele('cac:PartyName')
          .ele('cbc:Name').txt(data.emisor.razonSocial).up()
        .up()
      .up()
      .ele('cac:DigitalSignatureAttachment')
        .ele('cac:ExternalReference')
          .ele('cbc:URI').txt(`#Signature-${documentId}`).up()
        .up()
      .up()
    .up()
    // 6. Adquiriente / Emisor de la Liquidación (La Pollería)
    .ele('cac:AccountingSupplierParty')
      .ele('cac:Party')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', { schemeID: '6' }).txt(data.emisor.ruc).up()
        .up()
        .ele('cac:PartyName')
          .ele('cbc:Name').txt(data.emisor.nombreComercial || data.emisor.razonSocial).up()
        .up()
        .ele('cac:PartyLegalEntity')
          .ele('cbc:RegistrationName').txt(data.emisor.razonSocial).up()
          .ele('cac:RegistrationAddress')
            .ele('cbc:ID').txt(data.emisor.ubigeo).up()
            .ele('cbc:AddressTypeCode').txt('0000').up()
            .ele('cac:AddressLine')
              .ele('cbc:Line').txt(data.emisor.direccion).up()
            .up()
            .ele('cbc:CityName').txt(data.emisor.provincia).up()
            .ele('cbc:CountrySubentity').txt(data.emisor.departamento).up()
            .ele('cbc:District').txt(data.emisor.distrito).up()
            .ele('cac:Country')
              .ele('cbc:IdentificationCode').txt('PE').up()
            .up()
          .up()
        .up()
      .up()
    .up()
    // 7. Vendedor / Productor Artesanal o Campesino sin RUC (Identificado con DNI)
    .ele('cac:AccountingCustomerParty')
      .ele('cac:Party')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', { schemeID: data.vendedor.tipoDoc }).txt(data.vendedor.numDoc).up()
        .up()
        .ele('cac:PartyLegalEntity')
          .ele('cbc:RegistrationName').txt(data.vendedor.rznSocial).up()
        .up()
      .up()
    .up()
    // 8. Totales de Impuestos (IGV 18%)
    .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(igvFormatted).up()
      .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: data.moneda }).txt(subtotalFormatted).up()
        .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(igvFormatted).up()
        .ele('cac:TaxCategory')
          .ele('cac:TaxScheme')
            .ele('cbc:ID').txt('1000').up()
            .ele('cbc:Name').txt('IGV').up()
            .ele('cbc:TaxTypeCode').txt('VAT').up()
          .up()
        .up()
      .up()
    .up()
    // 9. Total Monetario Legal y Retenciones de Liquidación de Compra
    .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: data.moneda }).txt(subtotalFormatted).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: data.moneda }).txt(totalFormatted).up()
      .ele('cbc:PayableAmount', { currencyID: data.moneda }).txt(totalPagarFormatted).up()
    .up();

  // 10. Líneas de Detalle de Insumos Comprados
  data.items.forEach((item, index) => {
    const itemSubtotal = (item.valorUnitario * item.cantidad).toFixed(2);
    const itemIgv = (item.igv).toFixed(2);

    doc.ele('cac:InvoiceLine')
      .ele('cbc:ID').txt(String(index + 1)).up()
      .ele('cbc:InvoicedQuantity', { unitCode: item.unidadMedida || 'KGM' }).txt(item.cantidad.toString()).up()
      .ele('cbc:LineExtensionAmount', { currencyID: data.moneda }).txt(itemSubtotal).up()
      .ele('cac:PricingReference')
        .ele('cac:AlternativeConditionPrice')
          .ele('cbc:PriceAmount', { currencyID: data.moneda }).txt(item.precioUnitario.toFixed(2)).up()
          .ele('cbc:PriceTypeCode').txt('01').up()
        .up()
      .up()
      .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(itemIgv).up()
        .ele('cac:TaxSubtotal')
          .ele('cbc:TaxableAmount', { currencyID: data.moneda }).txt(itemSubtotal).up()
          .ele('cbc:TaxAmount', { currencyID: data.moneda }).txt(itemIgv).up()
          .ele('cac:TaxCategory')
            .ele('cbc:Percent').txt('18.00').up()
            .ele('cbc:TaxExemptionReasonCode').txt(item.codigoAfectacionIgv || '10').up()
            .ele('cac:TaxScheme')
              .ele('cbc:ID').txt('1000').up()
              .ele('cbc:Name').txt('IGV').up()
              .ele('cbc:TaxTypeCode').txt('VAT').up()
            .up()
          .up()
        .up()
      .up()
      .ele('cac:Item')
        .ele('cbc:Description').txt(item.descripcion).up()
        .ele('cac:SellersItemIdentification')
          .ele('cbc:ID').txt(item.codigo).up()
        .up()
      .up()
      .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: data.moneda }).txt(item.valorUnitario.toFixed(2)).up()
      .up()
    .up();
  });

  return doc.end({ prettyPrint: true });
}

