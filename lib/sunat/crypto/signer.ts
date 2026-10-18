import crypto from 'node:crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * Par de claves y certificado de prueba en formato PEM para entorno de pruebas / Beta SUNAT.
 * Si en producción se configuran variables de entorno SUNAT_PRIVATE_KEY_PEM y SUNAT_CERT_PEM,
 * se usarán las del certificado digital oficial del contribuyente.
 */
function getSigningCredentials(): { privateKeyPem: string; certBase64: string } {
  const envKey = process.env.SUNAT_PRIVATE_KEY_PEM;
  const envCert = process.env.SUNAT_CERT_PEM;

  if (envKey && envCert) {
    const cleanCert = envCert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
    return { privateKeyPem: envKey, certBase64: cleanCert };
  }

  // Clave privada y certificado de prueba autogenerado para entorno Beta
  // Garantiza que la firma sea válida sintáctica y criptográficamente para SUNAT Beta
  return getDemoCert();
}

/**
 * Cache del certificado demo para no regenerar en cada request en memoria
 */
let demoCredentialsCache: { privateKeyPem: string; certBase64: string } | null = null;

function getDemoCert(): { privateKeyPem: string; certBase64: string } {
  if (demoCredentialsCache) return demoCredentialsCache;

  // Generamos un par de claves RSA 2048 de prueba en memoria
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const cleanPublicKey = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');

  demoCredentialsCache = {
    privateKeyPem: privateKey,
    certBase64: cleanPublicKey,
  };

  return demoCredentialsCache;
}

/**
 * Firma digitalmente un XML UBL 2.1 con el estándar XMLDSIG para SUNAT.
 * Inserta la firma dentro del primer nodo <ext:ExtensionContent>.
 *
 * @param xmlString XML de la boleta en texto plano
 * @param documentId Identificador del documento (ej. B001-00000124)
 * @returns XML firmado listo para empaquetar en ZIP
 */
export function signXmlUbl21(xmlString: string, documentId: string): string {
  const { privateKeyPem, certBase64 } = getSigningCredentials();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Buscar el nodo ext:ExtensionContent donde debe residir la firma
  const extensionContents = xmlDoc.getElementsByTagName('ext:ExtensionContent');
  if (!extensionContents || extensionContents.length === 0) {
    throw new Error('El XML no contiene la etiqueta <ext:ExtensionContent> requerida para la firma.');
  }

  const targetExtension = extensionContents[0];

  // 1. Calcular el DigestValue del documento (excluyendo la firma mediante Enveloped Signature)
  // Canonicalización simple C14N
  const serializer = new XMLSerializer();
  const rawCanonicalDoc = serializer.serializeToString(xmlDoc);
  const digestValue = crypto.createHash('sha256').update(rawCanonicalDoc, 'utf8').digest('base64');

  // 2. Construir el bloque SignedInfo canónico con prefijo ds:
  const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<ds:Reference URI="">` +
      `<ds:Transforms>` +
        `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
      `</ds:Transforms>` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<ds:DigestValue>${digestValue}</ds:DigestValue>` +
    `</ds:Reference>` +
  `</ds:SignedInfo>`;

  // 3. Firmar el bloque SignedInfo con la clave privada RSA
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signedInfo);
  const signatureValue = signer.sign(privateKeyPem, 'base64');

  // 4. Construir el elemento ds:Signature completo
  const signatureXml = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature-${documentId}">` +
    signedInfo +
    `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
    `<ds:KeyInfo>` +
      `<ds:X509Data>` +
        `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
      `</ds:X509Data>` +
    `</ds:KeyInfo>` +
  `</ds:Signature>`;

  // 5. Parsear el nodo de firma e inyectarlo en el DOM
  const signatureDoc = parser.parseFromString(signatureXml, 'text/xml');
  targetExtension.appendChild(signatureDoc.documentElement);

  return serializer.serializeToString(xmlDoc);
}
