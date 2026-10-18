# Especificación Técnica: Microservicio Serverless de Facturación Electrónica SUNAT (UBL 2.1)

**ID:** `040-facturacion-electronica-sunat-ubl21`  
**Módulo:** Ventas / Facturación Electrónica SUNAT  
**Plataforma de Despliegue:** Vercel (Next.js Serverless Functions)  
**Estándar:** UBL 2.1 (Universal Business Language) - Resolución de Superintendencia SUNAT  

---

## 1. Resumen y Justificación Técnica

Este microservicio implementa la emisión, firmado digital, envío SOAP y almacenamiento en la nube de **Boletas de Venta Electrónicas (Tipo 03)** para el restaurante/pollería bajo la normativa peruana de SUNAT.

Dado que el entorno de producción es **Vercel Serverless**, la arquitectura respeta las restricciones de ejecución efímera:
1. **Zero Disk I/O:** Ningún archivo (XML, ZIP o CDR) se escribe en el disco local (`/tmp` o `./`). Toda la manipulación de bytes se realiza en memoria mediante `Buffer`, `Stream` y `Uint8Array`.
2. **Stateless y Escalable:** Cada petición procesa el ciclo completo en menos de 5 segundos, compatible con los timeouts de Vercel.
3. **Resguardo en AWS S3:** Tanto el XML firmado como la Constancia de Recepción (CDR) emitida por SUNAT se persisten directamente en el bucket S3 del restaurante.

---

## 2. Justificación de Librerías y Dependencias

Para sustentar técnicamente ante la cátedra / revisión de arquitectura:

| Dependencia | Propósito | Justificación Técnica |
| :--- | :--- | :--- |
| **`xmlbuilder2`** | Generación de XML UBL 2.1 | Permite construir árboles XML declarativos de alto rendimiento, asegurando namespaces requeridos por SUNAT (`cac`, `cbc`, `ext`, `ds`, `qdt`, `udt`) sin fugas de memoria. |
| **`xml-crypto`** | Firma Digital XMLDSIG | Implementación pura en Node.js del estándar W3C XML Signature Syntax and Processing (`http://www.w3.org/2000/09/xmldsig#`). Realiza canonicalización C14N y cálculo de digest/hash SHA-256 o SHA-1. |
| **`@xmldom/xmldom`** | Parser DOM en memoria | Parser DOM W3C estándar compatible con Vercel Serverless (sin dependencias nativas de C++ como libxmljs que rompen en entornos serverless). |
| **`adm-zip`** | Empaquetado y descompresión ZIP | Crea y descomprime archivos `.zip` directamente desde buffers de memoria (`Buffer.from(...)`) sin tocar el sistema de archivos del sistema operativo. |
| **`axios`** | Cliente HTTP / SOAP | Permite configurar payloads SOAP XML con cabeceras `Content-Type: text/xml;charset=utf-8` y `SOAPAction: ""` hacia el Web Service de SUNAT. |
| **`@aws-sdk/client-s3`** | Almacenamiento en la nube | Cliente oficial modular de AWS v3 para Node.js, optimizado para tree-shaking y mínimo tamaño en bundles de Vercel. |

---

## 3. Flujo del Ciclo de Vida del Comprobante

```
 [Cliente / POS]
        │  POST /api/sunat/boleta (JSON con datos del pedido y cliente)
        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Generador UBL 2.1 (lib/sunat/ubl/builder.ts)             │
 │    - Crea XML <Invoice> con namespaces oficiales de SUNAT    │
 │    - Estructura totales: Gravada, IGV (18%), Total Venta    │
 └──────────────────────────────┬──────────────────────────────┘
                                │ XML sin firmar (string)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Firmador Digital (lib/sunat/crypto/signer.ts)            │
 │    - Inserta <ds:Signature> dentro de <ext:ExtensionContent>│
 │    - Calcula DigestValue (SHA-256) y SignatureValue (RSA)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ XML firmado (string)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Empaquetador y Cliente SOAP (lib/sunat/soap/client.ts)   │
 │    - Genera {RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.zip en RAM   │
 │    - Envelope SOAP <soapenv:Body><sendBill> en Base64       │
 │    - POST https://e-beta.sunat.gob.pe/.../billService       │
 │      Credenciales: {RUC}MODDATOS / moddatos                 │
 └──────────────────────────────┬──────────────────────────────┘
                                │ SOAP Response con applicationResponse (Base64)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. Extracción de CDR y Subida a AWS S3                      │
 │    - Descomprime R-{RUC}-{TIPO}-{SERIE}-{NUMERO}.zip en RAM │
 │    - Lee código de respuesta (0 = Aceptado, >0 = Observado) │
 │    - PutObjectCommand: Sube XML y CDR a S3                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
                  JSON con estado, CDR y URLs S3
```

---

## 4. Estructura de Archivos Creada

```text
lib/sunat/
├── types.ts          # Interfaces de datos de boleta, ítems, emisor y CDR
├── ubl/
│   └── builder.ts    # Construcción declarativa UBL 2.1 con xmlbuilder2
├── crypto/
│   └── signer.ts     # Firma electrónica XMLDSIG en memoria
├── soap/
│   └── client.ts     # Generación de ZIP, SOAP Envelope y llamada a SUNAT Beta
└── storage/
    └── s3.ts         # Persistencia directa de XML y CDR en AWS S3

app/api/sunat/boleta/
└── route.ts          # Endpoint API Serverless de emisión de boleta

test/
└── sunat-fe.test.ts  # Pruebas automatizadas de generación UBL y firmado
```

---

## 5. Parámetros de Entorno

```env
# SUNAT Beta / Homologación
SUNAT_RUC=20000000001
SUNAT_USER=MODDATOS
SUNAT_PASSWORD=moddatos
SUNAT_ENDPOINT=https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService

# AWS S3 (Comprobantes y CDR)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=...
```
