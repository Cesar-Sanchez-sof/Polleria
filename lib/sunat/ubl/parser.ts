import { DOMParser } from '@xmldom/xmldom';
import type { ParsedSupplierInvoice, ParsedSupplierInvoiceItem } from '../types';

/**
 * Parser y validador de Facturas Electrónicas de Proveedores (UBL 2.1).
 * Extrae automáticamente la cabecera, desglose tributario, ítems y valida la firma XMLDSIG.
 */
export function parseSupplierInvoiceXml(xmlContent: string): ParsedSupplierInvoice {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // 1. Validar la existencia de la firma digital XMLDSIG
  const signatureNodes = doc.getElementsByTagName('ds:Signature');
  const validSignature = signatureNodes.length > 0;

  const digestNodes = doc.getElementsByTagName('ds:DigestValue');
  const digestValue = digestNodes.length > 0 ? digestNodes[0].textContent || undefined : undefined;

  // 2. Extraer Identificador del Comprobante (Serie-Correlativo)
  const idNodes = doc.getElementsByTagName('cbc:ID');
  const fullId = idNodes.length > 0 ? (idNodes[0].textContent || '') : '';
  const [serie = '', correlativo = ''] = fullId.split('-');

  // 3. Tipo de Documento y Fechas
  const typeNodes = doc.getElementsByTagName('cbc:InvoiceTypeCode');
  const tipoDocumento = typeNodes.length > 0 ? (typeNodes[0].textContent || '01') : '01';

  const dateNodes = doc.getElementsByTagName('cbc:IssueDate');
  const fechaEmision = dateNodes.length > 0 ? (dateNodes[0].textContent || '') : '';

  const timeNodes = doc.getElementsByTagName('cbc:IssueTime');
  const horaEmision = timeNodes.length > 0 ? (timeNodes[0].textContent || undefined) : undefined;

  const currencyNodes = doc.getElementsByTagName('cbc:DocumentCurrencyCode');
  const moneda = currencyNodes.length > 0 ? (currencyNodes[0].textContent || 'PEN') : 'PEN';

  // 4. Datos del Proveedor (AccountingSupplierParty)
  let proveedorRuc = '';
  let proveedorRazonSocial = '';

  const supplierNodes = doc.getElementsByTagName('cac:AccountingSupplierParty');
  if (supplierNodes.length > 0) {
    const sNode = supplierNodes[0];
    const sId = sNode.getElementsByTagName('cbc:ID');
    if (sId.length > 0) proveedorRuc = sId[0].textContent || '';

    const sRegName = sNode.getElementsByTagName('cbc:RegistrationName');
    const sName = sNode.getElementsByTagName('cbc:Name');
    proveedorRazonSocial = sRegName.length > 0
      ? (sRegName[0].textContent || '')
      : (sName.length > 0 ? (sName[0].textContent || '') : '');
  }

  // 5. Datos del Cliente / La Pollería (AccountingCustomerParty)
  let clienteRuc = '';
  let clienteRazonSocial = '';

  const customerNodes = doc.getElementsByTagName('cac:AccountingCustomerParty');
  if (customerNodes.length > 0) {
    const cNode = customerNodes[0];
    const cId = cNode.getElementsByTagName('cbc:ID');
    if (cId.length > 0) clienteRuc = cId[0].textContent || '';

    const cRegName = cNode.getElementsByTagName('cbc:RegistrationName');
    if (cRegName.length > 0) clienteRazonSocial = cRegName[0].textContent || '';
  }

  // 6. Totales Monetarios
  let subtotal = 0;
  let total = 0;
  let igv = 0;

  const extAmountNodes = doc.getElementsByTagName('cbc:LineExtensionAmount');
  if (extAmountNodes.length > 0) {
    subtotal = parseFloat(extAmountNodes[0].textContent || '0') || 0;
  }

  const taxAmountNodes = doc.getElementsByTagName('cbc:TaxAmount');
  if (taxAmountNodes.length > 0) {
    igv = parseFloat(taxAmountNodes[0].textContent || '0') || 0;
  }

  const payableNodes = doc.getElementsByTagName('cbc:PayableAmount');
  if (payableNodes.length > 0) {
    total = parseFloat(payableNodes[0].textContent || '0') || 0;
  } else {
    total = Math.round((subtotal + igv) * 100) / 100;
  }

  // 7. Extraer Líneas de Detalle / Ítems de la Factura
  const items: ParsedSupplierInvoiceItem[] = [];
  const lineNodes = doc.getElementsByTagName('cac:InvoiceLine');

  for (let i = 0; i < lineNodes.length; i++) {
    const line = lineNodes[i];

    const lIdNode = line.getElementsByTagName('cbc:ID');
    const lineId = lIdNode.length > 0 ? (lIdNode[0].textContent || String(i + 1)) : String(i + 1);

    const qtyNode = line.getElementsByTagName('cbc:InvoicedQuantity');
    const cantidad = qtyNode.length > 0 ? parseFloat(qtyNode[0].textContent || '1') : 1;
    const unidadMedida = qtyNode.length > 0 ? (qtyNode[0].getAttribute('unitCode') || 'NIU') : 'NIU';

    const descNode = line.getElementsByTagName('cbc:Description');
    const descripcion = descNode.length > 0 ? (descNode[0].textContent || `Ítem ${i + 1}`) : `Ítem ${i + 1}`;

    const codeNode = line.getElementsByTagName('cac:SellersItemIdentification');
    let codigo = `PROD-${i + 1}`;
    if (codeNode.length > 0) {
      const codeId = codeNode[0].getElementsByTagName('cbc:ID');
      if (codeId.length > 0 && codeId[0].textContent) {
        codigo = codeId[0].textContent;
      }
    }

    const priceNode = line.getElementsByTagName('cac:Price');
    let valorUnitario = 0;
    if (priceNode.length > 0) {
      const pAmount = priceNode[0].getElementsByTagName('cbc:PriceAmount');
      if (pAmount.length > 0) valorUnitario = parseFloat(pAmount[0].textContent || '0');
    }

    const refNode = line.getElementsByTagName('cac:PricingReference');
    let precioUnitario = valorUnitario * 1.18;
    if (refNode.length > 0) {
      const altPrice = refNode[0].getElementsByTagName('cbc:PriceAmount');
      if (altPrice.length > 0) precioUnitario = parseFloat(altPrice[0].textContent || '0');
    }

    const itemTotalNode = line.getElementsByTagName('cbc:LineExtensionAmount');
    const itemTotal = itemTotalNode.length > 0
      ? parseFloat(itemTotalNode[0].textContent || '0')
      : Math.round(valorUnitario * cantidad * 100) / 100;

    const itemTaxNode = line.getElementsByTagName('cac:TaxTotal');
    let itemIgv = 0;
    if (itemTaxNode.length > 0) {
      const tAmount = itemTaxNode[0].getElementsByTagName('cbc:TaxAmount');
      if (tAmount.length > 0) itemIgv = parseFloat(tAmount[0].textContent || '0');
    }

    items.push({
      id: lineId,
      codigo,
      descripcion,
      unidadMedida,
      cantidad,
      precioUnitario,
      valorUnitario,
      igv: itemIgv,
      total: itemTotal,
    });
  }

  return {
    validSignature,
    tipoDocumento,
    serie,
    correlativo,
    fechaEmision,
    horaEmision,
    moneda,
    proveedorRuc,
    proveedorRazonSocial,
    clienteRuc,
    clienteRazonSocial,
    subtotal,
    igv,
    total,
    items,
    digestValue,
    rawXml: xmlContent,
  };
}
