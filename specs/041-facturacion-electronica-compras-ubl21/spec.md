# Especificación Técnica: Facturación Electrónica en Compras SUNAT (UBL 2.1)

**ID:** `041-facturacion-electronica-compras-ubl21`  
**Módulo:** Compras / Facturación Electrónica SUNAT  
**Plataforma de Despliegue:** Vercel (Next.js Serverless Functions)  
**Estándar:** UBL 2.1 (Universal Business Language) - Resoluciones de Superintendencia SUNAT  

---

## 1. Fundamentación Tributaria y Académica (SUNAT Perú)

A diferencia del módulo de ventas (donde el restaurante siempre actúa como emisor emitiendo Boletas `03` y Facturas `01`), en el **Módulo de Compras** la facturación electrónica bajo normativa SUNAT opera bajo dos pilares esenciales:

### A. Emisión de Liquidaciones de Compra Electrónica (Comprobante Tipo `04` - UBL 2.1)
* **¿Qué es?:** Es el comprobante oficial que emite la propia Pollería cuando adquiere productos primarios (pollos vivos de granja, papas nativas, verduras, carbón vegetal) a personas naturales productoras del campo o artesanos que no cuentan con RUC y que no pueden emitir comprobante de pago por sí mismos.
* **Marco Legal SUNAT:** Regulado por el Reglamento de Comprobantes de Pago de SUNAT y la RS N° 317-2017/SUNAT (incorporación de la Liquidación de Compra al Sistema de Emisión Electrónica SEE).
* **Mecanismo Tributario:** La Pollería asume la condición de agente de retención del Impuesto a la Renta (1.5%) y/o IGV correspondiente, genera el XML UBL 2.1 con tipo de comprobante `04`, lo firma con su certificado digital XMLDSIG, lo transmite a SUNAT vía SOAP `sendBill`, obtiene el CDR y lo archiva en S3.

### B. Recepción, Parseo y Validación de Facturas Electrónicas de Proveedores (Tipo `01` - UBL 2.1)
* **¿Qué es?:** Es el procesamiento automático de los comprobantes electrónicos que los proveedores formales (avícolas industriales como San Fernando/Redondos, distribuidores de bebidas, proveedores de empaques) emiten hacia la Pollería.
* **Problema que resuelve:** Elimina el error humano y la digitación manual. El usuario solo sube o envía el archivo XML del proveedor; el microservicio valida que la firma XMLDSIG sea válida, extrae el RUC emisor, serie, número, fechas, desglose tributario (Base Gravada, Exonerada, IGV) y los ítems con sus costos unitarios para alimentar automáticamente el inventario y las cuentas por pagar.

---

## 2. Diagrama de Arquitectura y Flujos en Compras

```
                       COMPRAS ELECTRÓNICAS (SUNAT UBL 2.1)
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         ▼                                                         ▼
[FLUJO A: EMISIÓN]                                        [FLUJO B: RECEPCIÓN]
Liquidación de Compra (Tipo 04)                           Factura de Proveedor (Tipo 01)
(Para compra de insumos a productores sin RUC)             (Para compras a proveedores formales)
         │                                                         │
         ▼                                                         ▼
1. Generación UBL 2.1 (xmlbuilder2)                       1. Recepción de XML del Proveedor
   - cbc:InvoiceTypeCode: "04"                               (Base64 o multipart/form-data)
   - Retención de Renta (1.5%) e IGV                               │
         │                                                         ▼
         ▼                                                2. Parser UBL 2.1 en memoria
2. Firma Digital XMLDSIG (W3C)                               - Valida presencia de <ds:Signature>
   - Enveloped signature con SHA-256                         - Extrae RUC, Serie, Número, IGV
         │                                                   - Extrae lista de productos y costos
         ▼                                                         │
3. Empaquetado ZIP y Envío SOAP                                    ▼
   - POST a SUNAT Beta (MODDATOS)                         3. Registro en Cuentas por Pagar
   - Extracción de CDR en memoria                            - Creación de PurchaseInvoice en BD
         │                                                         │
         ▼                                                         ▼
4. Almacenamiento en AWS S3                               4. Resguardo Digital en AWS S3
   - Resguardo de XML firmado y CDR                          - XML y CDR del proveedor en S3
```

---

## 3. Especificación de Endpoints y Servicios

| Endpoint | Método | Permiso ISO 27001 | Descripción |
| :--- | :--- | :--- | :--- |
| `/api/sunat/liquidacion-compra` | `POST` | `compras.crear` | Emite una Liquidación de Compra Electrónica UBL 2.1 (Tipo `04`), la firma, envía a SUNAT y resguarda en S3. |
| `/api/sunat/compras/validar-xml` | `POST` | `compras.crear` | Recibe el XML UBL 2.1 de un proveedor, valida su firma XMLDSIG y extrae automáticamente los datos tributarios e ítems. |
| `/api/sunat/liquidacion-compra` | `GET` | `compras.ver` | Retorna metadatos y estado del servicio de liquidaciones de compra. |

---

## 4. Estructura de Archivos a Implementar

```text
lib/sunat/
├── types.ts                  # Ampliación: SunatLiquidacionCompraData y ParsedSupplierInvoice
├── ubl/
│   ├── builder.ts            # Ampliación: buildLiquidacionCompraUbl21Xml (Tipo 04)
│   └── parser.ts             # NUEVO: Parser y validador de XML UBL 2.1 de proveedores
├── index.ts                  # Fachada con emitirLiquidacionCompraSunat y procesarFacturaCompraElectronica

app/api/sunat/
├── liquidacion-compra/
│   └── route.ts              # Endpoint serverless para emisión de Liquidación de Compra 04
└── compras/
    └── validar-xml/
        └── route.ts          # Endpoint serverless para parseo y validación de XML proveedor

test/
└── sunat-fe-compras.test.ts  # Pruebas automatizadas de ambos flujos de compras
```
