/**
 * Utilidades y reglas de negocio para el módulo de Ventas, Gestión de Mesas y Facturación.
 */

export interface CalculationItem {
  cantidad: number;
  precioUnitario: number;
}

export interface CalculatedTotals {
  total: number;
  subtotal: number;
  igv: number;
}

/**
 * Calcula el importe total, subtotal gravado y el IGV (18%) conforme a la normativa SUNAT.
 * En gastronomía en Perú, los precios de carta ya incluyen el 18% de IGV.
 */
export function calculateTotals(items: CalculationItem[]): CalculatedTotals {
  if (!items || items.length === 0) {
    return { total: 0, subtotal: 0, igv: 0 };
  }

  const sum = items.reduce((acc, it) => {
    const qty = Math.max(0, it.cantidad || 0);
    const price = Math.max(0, it.precioUnitario || 0);
    return acc + qty * price;
  }, 0);

  const total = Math.round(sum * 100) / 100;
  // Subtotal base imponible (desglosando el 18% de IGV)
  const subtotal = Math.round((total / 1.18) * 100) / 100;
  const igv = Math.round((total - subtotal) * 100) / 100;

  return { total, subtotal, igv };
}

/**
 * Calcula el vuelto al pagar en efectivo.
 * Valida que el monto recibido cubra el total de la cuenta.
 */
export function calculateChangeAmount(
  total: number,
  amountReceived: number
): { vuelto: number; isValid: boolean; error?: string } {
  const totalAmount = Math.round((total || 0) * 100) / 100;
  const received = Math.round((amountReceived || 0) * 100) / 100;

  if (received < totalAmount) {
    const shortage = Math.round((totalAmount - received) * 100) / 100;
    return {
      vuelto: 0,
      isValid: false,
      error: `El monto entregado (S/ ${received.toFixed(2)}) es menor al total a pagar (S/ ${totalAmount.toFixed(2)}). Faltan S/ ${shortage.toFixed(2)}.`,
    };
  }

  const vuelto = Math.round((received - totalAmount) * 100) / 100;
  return { vuelto, isValid: true };
}

/**
 * Valida los números de documento peruanos (DNI 8 dígitos, RUC 11 dígitos).
 */
export function validateCustomerDocument(
  tipoPersona: "Natural" | "Juridico",
  nroDoc: string
): { isValid: boolean; error?: string } {
  const document = (nroDoc || "").trim();

  // Cliente general sin documento
  if (document === "00000000" || document === "") {
    return { isValid: true };
  }

  if (tipoPersona === "Natural") {
    // DNI debe tener 8 dígitos numéricos
    if (!/^\d{8}$/.test(document)) {
      return {
        isValid: false,
        error: "El DNI debe contener exactamente 8 dígitos numéricos.",
      };
    }
    return { isValid: true };
  }

  if (tipoPersona === "Juridico") {
    // RUC debe tener 11 dígitos numéricos y comenzar con 10, 15, 17 o 20
    if (!/^\d{11}$/.test(document)) {
      return {
        isValid: false,
        error: "El RUC debe contener exactamente 11 dígitos numéricos.",
      };
    }
    if (!/^(10|15|17|20)/.test(document)) {
      return {
        isValid: false,
        error: "El RUC debe comenzar con los dígitos 10, 15, 17 o 20.",
      };
    }
    return { isValid: true };
  }

  return { isValid: false, error: "Tipo de persona inválido." };
}

/**
 * Regla de negocio para edición de pedidos:
 * - Un pedido solo se puede editar si está en estado 'Recibido' o 'Preparando'.
 * - Cuando pasa a 'Servido' o 'Cerrado', ya no puede modificarse por comandas.
 */
export function canEditOrder(estado: string): boolean {
  const status = (estado || "").toLowerCase();
  return status === "recibido" || status === "preparando" || status === "pendiente";
}

/**
 * Calcula el resumen de ocupación de mesas en sala.
 */
export function calculateTablesSummary(mesas: Array<{ ocupada: boolean }>): {
  total: number;
  disponibles: number;
  ocupadas: number;
} {
  const total = mesas.length;
  const ocupadas = mesas.filter((m) => m.ocupada).length;
  const disponibles = total - ocupadas;
  return { total, disponibles, ocupadas };
}

export interface SaleRecordSummary {
  monto_total: number;
  metodo_pago?: string;
  tipo_comprobante?: string;
  fecha_emision?: string | Date;
}

/**
 * Calcula los totales y desgloses de ventas diarias para el arqueo de caja y facturación.
 */
export function calculateDailySalesSummary(ventas: SaleRecordSummary[]) {
  let totalRecaudado = 0;
  let totalEfectivo = 0;
  let totalYape = 0;
  let totalTarjeta = 0;
  let totalOtros = 0;

  let boletasCount = 0;
  let facturasCount = 0;
  let ticketsCount = 0;

  for (const v of ventas) {
    const amount = Number(v.monto_total) || 0;
    totalRecaudado += amount;

    const paymentMethod = (v.metodo_pago || "").toLowerCase();
    if (paymentMethod.includes("efectivo")) {
      totalEfectivo += amount;
    } else if (paymentMethod.includes("yape")) {
      totalYape += amount;
    } else if (paymentMethod.includes("tarjeta") || paymentMethod.includes("pos")) {
      totalTarjeta += amount;
    } else {
      totalOtros += amount;
    }

    const voucherType = (v.tipo_comprobante || "").toLowerCase();
    if (voucherType.includes("factura")) {
      facturasCount++;
    } else if (voucherType.includes("ticket")) {
      ticketsCount++;
    } else {
      boletasCount++;
    }
  }

  return {
    totalRecaudado: Math.round(totalRecaudado * 100) / 100,
    cantidadVentas: ventas.length,
    desgloseMetodos: {
      efectivo: Math.round(totalEfectivo * 100) / 100,
      yape: Math.round(totalYape * 100) / 100,
      tarjeta: Math.round(totalTarjeta * 100) / 100,
      otros: Math.round(totalOtros * 100) / 100,
    },
    desgloseComprobantes: {
      boletas: boletasCount,
      facturas: facturasCount,
      tickets: ticketsCount,
    },
  };
}
