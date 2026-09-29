import crypto from "crypto";

/**
 * Servicio de Integración con Mercado Pago (Presencial / Tap to Pay / Point / Webhook).
 * 
 * Diseñado con arquitectura desacoplada:
 * - Si MERCADO_PAGO_ACCESS_TOKEN está configurado en .env, realiza las peticiones oficiales a la API de Mercado Pago.
 * - Si aún no está configurado, funciona en modo "Simulación / Sandbox Local" para no consumir tokens ni bloquear el sistema.
 */

export interface DatosCobroMercadoPago {
  idPedido: number;
  codigoComanda: string;
  monto: number;
  descripcion?: string;
  deviceId?: string; // ID físico del terminal Point si se usa dispositivo
  urlRetorno?: string;
}

export interface IntentoCobroResultado {
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
export function obtenerAccessToken(): string | null {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
}

/**
 * Genera el enlace de apertura nativa (Deep Link) para que el celular del mozo
 * abra la app de Mercado Pago directamente en la pantalla de cobro con tarjeta (Tap to Pay / NFC).
 */
export function generarDeepLinkTapToPay(datos: DatosCobroMercadoPago): string {
  const monto = (Math.round(datos.monto * 100) / 100).toFixed(2);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const urlRetorno = encodeURIComponent(
    datos.urlRetorno || `${baseUrl}/ventas?tab=mesas&cobro_exitoso=${datos.idPedido}`
  );
  const desc = encodeURIComponent(`Polleria - Comanda ${datos.codigoComanda}`);

  // Esquema nativo oficial de Mercado Pago para cobro en celular / Point
  // Al abrir esta URL en Android/iOS, se lanza la app de Mercado Pago con el monto precargado
  return `mercadopago://point/pay?amount=${monto}&description=${desc}&success_url=${urlRetorno}&fail_url=${urlRetorno}`;
}

/**
 * Inicia la intención de cobro con Mercado Pago.
 * Si no hay token de producción, genera el DeepLink y retorna modo preparado sin fallar.
 */
export async function iniciarCobroMercadoPago(
  datos: DatosCobroMercadoPago
): Promise<IntentoCobroResultado> {
  const token = obtenerAccessToken();
  const deepLink = generarDeepLinkTapToPay(datos);

  // MODO 1: Sin Token (Modo Preparado / Simulación Inteligente)
  if (!token || token.trim() === "" || token.includes("TU_ACCESS_TOKEN")) {
    return {
      modo: "tap_to_pay",
      operacionId: `MP-SIM-${Date.now()}-${datos.idPedido}`,
      estado: "simulado",
      deepLinkApp: deepLink,
      mensaje:
        "Módulo de Mercado Pago listo. Credenciales pendientes de ingresar en .env (MERCADO_PAGO_ACCESS_TOKEN). Cobro simulado exitoso.",
    };
  }

  // MODO 2: Con Token de Mercado Pago (API Oficial)
  try {
    // Si se especificó un deviceId (Point Smart/Bluetooth)
    if (datos.deviceId) {
      const res = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${datos.deviceId}/payment-intents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(datos.monto * 100), // En centavos para la API Point
            description: `Comanda ${datos.codigoComanda}`,
            additional_info: {
              external_reference: `PED-${datos.idPedido}`,
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
      operacionId: `MP-LIVE-${Date.now()}-${datos.idPedido}`,
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
export async function consultarPagoMercadoPago(paymentId: string | number): Promise<any> {
  const token = obtenerAccessToken();
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
export function obtenerWebhookSecret(): string | null {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET || null;
}

/**
 * Valida la firma criptográfica HMAC-SHA256 enviada en la cabecera x-signature por Mercado Pago.
 * Si MERCADO_PAGO_WEBHOOK_SECRET no está configurado, valida en modo tolerante (simulación / dev).
 */
export function verificarFirmaWebhookMercadoPago(params: {
  xSignatureHeader: string | null;
  xRequestIdHeader: string | null;
  dataId: string | null;
}): { valida: boolean; razon?: string } {
  const secret = obtenerWebhookSecret();

  // Modo seguro de desarrollo: Si no hay secreto configurado, acepta notificaciones sin bloquear
  if (!secret || secret.trim() === "" || secret.includes("TU_WEBHOOK_SECRET")) {
    return { valida: true, razon: "Modo relajado: MERCADO_PAGO_WEBHOOK_SECRET no configurado" };
  }

  if (!params.xSignatureHeader) {
    return { valida: false, razon: "Cabecera x-signature ausente" };
  }

  // Desglosar elementos de la cabecera: "ts=1700000000,v1=abc..."
  const partes = params.xSignatureHeader.split(",");
  let ts = "";
  let v1 = "";

  for (const parte of partes) {
    const [clave, valor] = parte.trim().split("=");
    if (clave === "ts") ts = valor;
    if (clave === "v1") v1 = valor;
  }

  if (!ts || !v1) {
    return { valida: false, razon: "Formato de x-signature inválido" };
  }

  // Prevenir ataques de repetición (tolerancia de 10 minutos)
  const ahora = Math.floor(Date.now() / 1000);
  const tiempoPeticion = parseInt(ts, 10);
  if (!Number.isNaN(tiempoPeticion) && Math.abs(ahora - tiempoPeticion) > 600) {
    return { valida: false, razon: "Firma expirada o timestamp desfasado" };
  }

  // Plantilla oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${params.dataId || ""};request-id:${params.xRequestIdHeader || ""};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  if (hmac.toLowerCase() === v1.toLowerCase()) {
    return { valida: true };
  }

  return { valida: false, razon: "Firma criptográfica HMAC no coincide" };
}
