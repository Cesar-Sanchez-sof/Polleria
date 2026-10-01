import crypto from "crypto";

/**
 * Servicio de Integración con Mercado Pago (Presencial / Tap to Pay / Point / Webhook).
 * 
 * Diseñado con arquitectura desacoplada:
 * - Si MERCADO_PAGO_ACCESS_TOKEN está configurado en .env, realiza las peticiones oficiales a la API de Mercado Pago.
 * - Si aún no está configurado, funciona en modo "Simulación / Sandbox Local" para no consumir tokens ni bloquear el sistema.
 */

export interface MercadoPagoChargeData {
  idPedido: number;
  codigoComanda: string;
  monto: number;
  descripcion?: string;
  deviceId?: string; // ID físico del terminal Point si se usa dispositivo
  urlRetorno?: string;
}

export interface ChargeAttemptResult {
  modo: "tap_to_pay" | "point_device" | "qr" | "simulado";
  operacionId: string;
  estado: "pendiente" | "aprobado" | "simulado";
  deepLinkApp?: string; // mercadopago:// para abrir la app en el celular del mozo
  qrData?: string;
  mensaje: string;
}

/**
 * Obtiene el Access Token desde las variables de entorno.
 */
export function getAccessToken(): string | null {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
}

/**
 * Genera el enlace de apertura nativa (Deep Link) para que el celular del mozo
 * abra la app de Mercado Pago directamente en la pantalla de cobro con tarjeta (Tap to Pay / NFC).
 */
export function generateTapToPayDeepLink(data: MercadoPagoChargeData): string {
  const amount = (Math.round(data.monto * 100) / 100).toFixed(2);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl = encodeURIComponent(
    data.urlRetorno || `${baseUrl}/sales?tab=tables&payment_success=${data.idPedido}`
  );
  const desc = encodeURIComponent(`Polleria - Comanda ${data.codigoComanda}`);

  // Esquema nativo oficial de Mercado Pago para cobro en celular / Point
  // Al abrir esta URL en Android/iOS, se lanza la app de Mercado Pago con el monto precargado
  return `mercadopago://point/pay?amount=${amount}&description=${desc}&success_url=${returnUrl}&fail_url=${returnUrl}`;
}

/**
 * Inicia la intención de cobro con Mercado Pago.
 * Si no hay token de producción, genera el DeepLink y retorna modo preparado sin fallar.
 */
export async function startMercadoPagoCharge(
  data: MercadoPagoChargeData
): Promise<ChargeAttemptResult> {
  const token = getAccessToken();
  const deepLink = generateTapToPayDeepLink(data);

  // MODO 1: Sin Token (Modo Preparado / Simulación Inteligente)
  if (!token || token.trim() === "" || token.includes("TU_ACCESS_TOKEN")) {
    return {
      modo: "tap_to_pay",
      operacionId: `MP-SIM-${Date.now()}-${data.idPedido}`,
      estado: "simulado",
      deepLinkApp: deepLink,
      mensaje:
        "Módulo de Mercado Pago listo. Credenciales pendientes de ingresar en .env (MERCADO_PAGO_ACCESS_TOKEN). Cobro simulado exitoso.",
    };
  }

  // MODO 2: Con Token de Mercado Pago (API Oficial)
  try {
    // Si se especificó un deviceId (Point Smart/Bluetooth)
    if (data.deviceId) {
      const res = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${data.deviceId}/payment-intents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(data.monto * 100), // En centavos para la API Point
            description: `Comanda ${data.codigoComanda}`,
            additional_info: {
              external_reference: `PED-${data.idPedido}`,
              print_on_terminal: true,
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        return {
          modo: "point_device",
          operacionId: json.id || `INTENT-${Date.now()}`,
          estado: "pendiente",
          deepLinkApp: deepLink,
          mensaje: "Orden enviada exitosamente al terminal Point.",
        };
      }
    }

    // Para Tap to Pay desde celular, el canal estándar es el Deep Link hacia la App de Mercado Pago
    return {
      modo: "tap_to_pay",
      operacionId: `MP-LIVE-${Date.now()}-${data.idPedido}`,
      estado: "pendiente",
      deepLinkApp: deepLink,
      mensaje: "Enlace Tap to Pay generado listo para cobro en celular.",
    };
  } catch (error: any) {
    console.error("[MercadoPago Service] Error al conectar con API:", error);
    return {
      modo: "tap_to_pay",
      operacionId: `MP-FALLBACK-${Date.now()}`,
      estado: "simulado",
      deepLinkApp: deepLink,
      mensaje: `Conexión con Mercado Pago en modo fallback: ${error.message || "Error de red"}`,
    };
  }
}

/**
 * Consulta el estado oficial de un pago en la API de Mercado Pago.
 */
export async function getMercadoPagoPayment(paymentId: string | number): Promise<any> {
  const token = getAccessToken();
  if (!token) {
    return { id: paymentId, status: "approved", status_detail: "simulated_without_token" };
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error en Mercado Pago API: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error("[MercadoPago Service] Error al consultar pago:", error);
    return null;
  }
}

/**
 * Obtiene el Webhook Secret desde las variables de entorno.
 */
export function getWebhookSecret(): string | null {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET || null;
}

/**
 * Valida la firma criptográfica HMAC-SHA256 enviada en la cabecera x-signature por Mercado Pago.
 * Si MERCADO_PAGO_WEBHOOK_SECRET no está configurado, valida en modo tolerante (simulación / dev).
 */
export function verifyMercadoPagoWebhookSignature(params: {
  xSignatureHeader: string | null;
  xRequestIdHeader: string | null;
  dataId: string | null;
}): { isValid: boolean; reason?: string } {
  const secret = getWebhookSecret();

  // Modo seguro de desarrollo: Si no hay secreto configurado, acepta notificaciones sin bloquear
  if (!secret || secret.trim() === "" || secret.includes("TU_WEBHOOK_SECRET")) {
    return { isValid: true, reason: "Modo relajado: MERCADO_PAGO_WEBHOOK_SECRET no configurado" };
  }

  if (!params.xSignatureHeader) {
    return { isValid: false, reason: "Cabecera x-signature ausente" };
  }

  // Desglosar elementos de la cabecera: "ts=1700000000,v1=abc..."
  const parts = params.xSignatureHeader.split(",");
  let ts = "";
  let v1 = "";

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }

  if (!ts || !v1) {
    return { isValid: false, reason: "Formato de x-signature inválido" };
  }

  // Prevenir ataques de repetición (tolerancia de 10 minutos)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(ts, 10);
  if (!Number.isNaN(requestTime) && Math.abs(now - requestTime) > 600) {
    return { isValid: false, reason: "Firma expirada o timestamp desfasado" };
  }

  // Plantilla oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${params.dataId || ""};request-id:${params.xRequestIdHeader || ""};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  if (hmac.toLowerCase() === v1.toLowerCase()) {
    return { isValid: true };
  }

  return { isValid: false, reason: "Firma criptográfica HMAC no coincide" };
}
