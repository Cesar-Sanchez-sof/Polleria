/**
 * Tipos e interfaces de datos para Facturación Electrónica SUNAT (UBL 2.1).
 */

export interface SunatCompany {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ubigeo: string;
}

export interface SunatCustomer {
  tipoDoc: '0' | '1' | '4' | '6' | '7'; // 1: DNI, 6: RUC, 0: Doc Trib No Dom / Sin doc
  numDoc: string;
  rznSocial: string;
  direccion?: string;
}

export interface SunatItem {
  id: number | string;
  codigo: string;
  descripcion: string;
  unidadMedida: string; // NIU para unidades, ZZ para servicios, etc.
  cantidad: number;
  precioUnitario: number; // Con IGV
  valorUnitario: number;  // Sin IGV
  igv: number;
  total: number;
  codigoAfectacionIgv?: string; // '10' Gravado - Operación Onerosa
}

export interface SunatBoletaData {
  serie: string;          // Ej: B001
  correlativo: number;    // Ej: 124
  fechaEmision: string;   // YYYY-MM-DD
  horaEmision: string;    // HH:mm:ss
  moneda: string;         // 'PEN' | 'USD'
  emisor: SunatCompany;
  cliente: SunatCustomer;
  items: SunatItem[];
  subtotal: number;       // Base imponible gravada
  igv: number;            // Total IGV 18%
  total: number;          // Total a pagar
}

export interface SunatCdrResponse {
  success: boolean;
  code: string;           // '0' para aceptado
  description: string;
  notes?: string[];
  rawCdrXml?: string;
  cdrZipBuffer?: Buffer;
}

export interface SunatSendResult {
  fileName: string;
  xmlSigned: string;
  cdr: SunatCdrResponse;
  s3XmlUrl?: string;
  s3CdrUrl?: string;
}

/**
 * Datos para emisión de Liquidación de Compra Electrónica (Tipo 04 - UBL 2.1).
 * Emitida por la Pollería a personas naturales sin RUC/negocio (ej: campesinos, avicultores).
 */
export interface SunatLiquidacionCompraData {
  serie: string;                  // Ej: E001
  correlativo: number;            // Ej: 1
  fechaEmision: string;           // YYYY-MM-DD
  horaEmision: string;            // HH:mm:ss
  moneda: string;                 // 'PEN'
  emisor: SunatCompany;           // La Pollería (comprador)
  vendedor: SunatCustomer;        // Persona Natural vendedora (DNI)
  items: SunatItem[];             // Insumos comprados (pollo vivo, papas, etc.)
  subtotal: number;               // Valor de compra gravado
  igv: number;                    // IGV 18%
  retencionRentaPorcentaje?: number; // Ej: 1.5%
  retencionRentaMonto?: number;
  total: number;                  // Importe total (subtotal + igv)
  totalPagar: number;             // Total a pagar al vendedor (total - retenciones)
}

/**
 * Ítem extraído de una Factura Electrónica de Proveedor UBL 2.1
 */
export interface ParsedSupplierInvoiceItem {
  id: string | number;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  valorUnitario: number;
  igv: number;
  total: number;
}

/**
 * Resultado del parseo y validación de una Factura Electrónica de Proveedor (UBL 2.1 - Tipo 01)
 */
export interface ParsedSupplierInvoice {
  validSignature: boolean;
  tipoDocumento: string; // '01' Factura, '03' Boleta, etc.
  serie: string;
  correlativo: string;
  fechaEmision: string;
  horaEmision?: string;
  moneda: string;
  proveedorRuc: string;
  proveedorRazonSocial: string;
  clienteRuc: string;
  clienteRazonSocial: string;
  subtotal: number;
  igv: number;
  total: number;
  items: ParsedSupplierInvoiceItem[];
  digestValue?: string;
  rawXml?: string;
}

