/**
 * Generador de Código QR Dinámico para Yape / BCP conforme al estándar oficial
 * EMVCo MPM (Merchant-Presented Mode) e Interoperabilidad del BCRP en Perú.
 * 
 * Permite que al escanear el QR desde la app de Yape en el celular del comensal:
 * 1. Se abra automáticamente la pantalla de pago de Yape.
 * 2. El MONTO EXACTO aparezca ya precargado (el usuario no tiene que tipear el total).
 * 3. El comensal solo deba presionar el botón morado "YAPEAR".
 */

export interface DynamicYapeQRInput {
  phone: string; // Número de celular afiliado a Yape (9 dígitos, ej: 954316272)
  amount: number; // Monto a cobrar en Soles (ej: 75.50)
  merchantName?: string; // Nombre del comercio o titular
  orderCode?: string; // Código de comanda / referencia (ej: PED-015)
  city?: string; // Ciudad (por defecto Lima)
  customQrImageUrl?: string; // Imagen oficial subida por el restaurante
}

export interface DynamicYapeQRResult {
  emvcoPayload: string; // Cadena codificada oficial EMVCo
  qrImageUrl: string; // URL directa de imagen del código QR listo para renderizar
  deepLink: string; // Enlace nativo para abrir Yape si está en el mismo móvil
  amountFormatted: string;
  phoneClean: string;
  phoneDisplay: string;
  merchantName: string;
  isCustomImage?: boolean;
}

/**
 * Calcula el checksum de redundancia cíclica CRC-16/CCITT-FALSE
 * requerido obligatoriamente por la especificación EMVCo (polinomio 0x1021, init 0xFFFF).
 */
export function calculateEmvcoCRC(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Formatea un tag EMVCo TLV (Tag - Length - Value).
 */
function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Limpia y normaliza el número de teléfono peruano a 9 dígitos.
 */
export function sanitizeYapePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Si viene con prefijo país 51, tomar los últimos 9 dígitos
  if (digits.startsWith("51") && digits.length === 11) {
    return digits.slice(2);
  }
  return digits.slice(-9);
}

/**
 * Genera el payload EMVCo dinámico con monto específico para Yape Perú.
 */
export function generateDynamicYapeQR(input: DynamicYapeQRInput): DynamicYapeQRResult {
  const phoneClean = sanitizeYapePhone(input.phone || "954316272");
  const roundedAmount = Math.round(input.amount * 100) / 100;
  const amountStr = roundedAmount.toFixed(2);
  const merchantName = (input.merchantName || "POLLERIA REST").toUpperCase().slice(0, 25);
  const city = (input.city || "LIMA").toUpperCase().slice(0, 15);
  const orderRef = input.orderCode || `PED-${Date.now().toString().slice(-4)}`;

  // 1. Tag 00: Payload Format Indicator ("01")
  const tag00 = formatTlv("00", "01");

  // 2. Tag 01: Point of Initiation Method:
  // "11" = Estático (sin monto fijo)
  // "12" = DINÁMICO (monto precargado fijado por el comercio -> el usuario no puede alterarlo)
  const tag01 = formatTlv("01", "12");

  // 3. Tag 26: Merchant Account Information para Yape (BCRP Interoperable)
  // Subtag 00: GUID o dominio de la red ("pe.yape" o "pe.bcp")
  // Subtag 01: Teléfono de cobro
  const subtag00 = formatTlv("00", "pe.yape");
  const subtag01 = formatTlv("01", phoneClean);
  const tag26 = formatTlv("26", `${subtag00}${subtag01}`);

  // 4. Tag 52: Merchant Category Code (5812 = Restaurantes / Establecimientos de comida rápida)
  const tag52 = formatTlv("52", "5812");

  // 5. Tag 53: Transaction Currency (604 = Código numérico ISO 4217 para Soles / PEN)
  const tag53 = formatTlv("53", "604");

  // 6. Tag 54: Transaction Amount (MONTO EXACTO DE LA COMANDA)
  const tag54 = formatTlv("54", amountStr);

  // 7. Tag 58: Country Code ("PE" = Perú)
  const tag58 = formatTlv("58", "PE");

  // 8. Tag 59: Merchant Name
  const tag59 = formatTlv("59", merchantName);

  // 9. Tag 60: Merchant City
  const tag60 = formatTlv("60", city);

  // 10. Tag 62: Additional Data Field (Número de orden / Comanda de referencia)
  const subtagRef = formatTlv("01", orderRef);
  const tag62 = formatTlv("62", subtagRef);

  // 11. Tag 63: CRC16 Checksum
  const partialPayload = `${tag00}${tag01}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const checksum = calculateEmvcoCRC(partialPayload);
  const emvcoPayload = `${partialPayload}${checksum}`;

  // URL del QR: si el usuario subió su QR oficial de Yape, usamos su imagen real. Si no, generamos el QR EMVCo
  const isCustomImage = Boolean(input.customQrImageUrl && input.customQrImageUrl.trim().length > 0);
  const qrImageUrl = isCustomImage
    ? input.customQrImageUrl!.trim()
    : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=2&data=${encodeURIComponent(
        emvcoPayload
      )}`;

  // Enlace directo universal para dispositivos móviles
  const deepLink = `yape://pay?phone=${phoneClean}&amount=${amountStr}&ref=${encodeURIComponent(orderRef)}`;

  const phoneDisplay = phoneClean.length === 9
    ? phoneClean.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : phoneClean;

  return {
    emvcoPayload,
    qrImageUrl,
    deepLink,
    amountFormatted: `S/ ${amountStr}`,
    phoneClean,
    phoneDisplay,
    merchantName,
    isCustomImage,
  };
}
