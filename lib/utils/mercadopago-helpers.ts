/**
 * Utilidades cliente/servidor para esquemas de cobro con Mercado Pago (Deep Links / NFC / Tap to Pay).
 * Seguro para importar tanto en componentes cliente ("use client") como en el servidor.
 */

export interface MercadoPagoChargeData {
  orderId: number;
  kitchenOrderCode: string;
  amount: number;
  description?: string;
  deviceId?: string;
  returnUrl?: string;
}

/**
 * Genera el enlace de apertura nativa (Deep Link) para que el celular del mozo
 * abra la app de Mercado Pago directamente en la pantalla de cobro con tarjeta (Tap to Pay / NFC).
 */
export function generateTapToPayDeepLink(data: MercadoPagoChargeData): string {
  const amount = (Math.round(data.amount * 100) / 100).toFixed(2);
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const returnUrl = encodeURIComponent(
    data.returnUrl || `${baseUrl}/sales?tab=tables&payment_success=${data.orderId}`
  );
  const desc = encodeURIComponent(`Polleria - Comanda ${data.kitchenOrderCode}`);

  // Esquema nativo oficial de Mercado Pago para cobro en celular / Point
  return `mercadopago://point/pay?amount=${amount}&description=${desc}&success_url=${returnUrl}&fail_url=${returnUrl}`;
}
