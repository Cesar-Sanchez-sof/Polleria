/**
 * Utilidades y reglas de negocio para el módulo de Ventas, Gestión de Mesas y Facturación.
 */

export interface ItemCalculo {
  cantidad: number;
  precioUnitario: number;
}

export interface TotalesCalculados {
  total: number;
  subtotal: number;
  igv: number;
}

/**
 * Calcula el importe total, subtotal gravado y el IGV (18%) conforme a la normativa SUNAT.
 * En gastronomía en Perú, los precios de carta ya incluyen el 18% de IGV.
 */
export function calcularTotales(items: ItemCalculo[]): TotalesCalculados {
  if (!items || items.length === 0) {
    return { total: 0, subtotal: 0, igv: 0 };
  }

  const suma = items.reduce((acc, it) => {
    const cant = Math.max(0, it.cantidad || 0);
    const precio = Math.max(0, it.precioUnitario || 0);
    return acc + cant * precio;
  }, 0);

  const total = Math.round(suma * 100) / 100;
  // Subtotal base imponible (desglosando el 18% de IGV)
  const subtotal = Math.round((total / 1.18) * 100) / 100;
  const igv = Math.round((total - subtotal) * 100) / 100;

  return { total, subtotal, igv };
}

/**
 * Calcula el vuelto al pagar en efectivo.
 * Valida que el monto recibido cubra el total de la cuenta.
 */
export function calcularVuelto(
  total: number,
  montoRecibido: number
): { vuelto: number; esValido: boolean; error?: string } {
  const tot = Math.round((total || 0) * 100) / 100;
  const recibido = Math.round((montoRecibido || 0) * 100) / 100;

  if (recibido < tot) {
    const faltante = Math.round((tot - recibido) * 100) / 100;
    return {
      vuelto: 0,
      esValido: false,
      error: `El monto entregado (S/ ${recibido.toFixed(2)}) es menor al total a pagar (S/ ${tot.toFixed(2)}). Faltan S/ ${faltante.toFixed(2)}.`,
    };
  }

  const vuelto = Math.round((recibido - tot) * 100) / 100;
  return { vuelto, esValido: true };
}

/**
 * Valida los números de documento peruanos (DNI 8 dígitos, RUC 11 dígitos).
 */
export function validarDocumentoCliente(
  tipoPersona: "Natural" | "Juridico",
  nroDoc: string
): { esValido: boolean; error?: string } {
  const doc = (nroDoc || "").trim();

  // Cliente general sin documento
  if (doc === "00000000" || doc === "") {
    return { esValido: true };
  }

  if (tipoPersona === "Natural") {
    // DNI debe tener 8 dígitos numéricos
    if (!/^\d{8}$/.test(doc)) {
      return {
        esValido: false,
        error: "El DNI debe contener exactamente 8 dígitos numéricos.",
      };
    }
    return { esValido: true };
  }

  if (tipoPersona === "Juridico") {
    // RUC debe tener 11 dígitos numéricos y comenzar con 10, 15, 17 o 20
    if (!/^\d{11}$/.test(doc)) {
      return {
        esValido: false,
        error: "El RUC debe contener exactamente 11 dígitos numéricos.",
      };
    }
    if (!/^(10|15|17|20)/.test(doc)) {
      return {
        esValido: false,
        error: "El RUC debe comenzar con los dígitos 10, 15, 17 o 20.",
      };
    }
    return { esValido: true };
  }

  return { esValido: false, error: "Tipo de persona inválido." };
}

/**
 * Regla de negocio para edición de pedidos:
 * - Un pedido solo se puede editar si está en estado 'Recibido' o 'Preparando'.
 * - Cuando pasa a 'Servido' o 'Cerrado', ya no puede modificarse por comandas.
 */
export function puedeEditarPedido(estado: string): boolean {
  const e = (estado || "").toLowerCase();
  return e === "recibido" || e === "preparando" || e === "pendiente";
}

/**
 * Calcula el resumen de ocupación de mesas en sala.
 */
export function calcularResumenMesas(mesas: Array<{ ocupada: boolean }>): {
  total: number;
  disponibles: number;
  ocupadas: number;
} {
  const total = mesas.length;
  const ocupadas = mesas.filter((m) => m.ocupada).length;
  const disponibles = total - ocupadas;
  return { total, disponibles, ocupadas };
}

export interface VentaRegistroResumen {
  monto_total: number;
  metodo_pago?: string;
  tipo_comprobante?: string;
  fecha_emision?: string | Date;
}

/**
 * Calcula los totales y desgloses de ventas diarias para el arqueo de caja y facturación.
 */
export function calcularResumenVentasDiarias(ventas: VentaRegistroResumen[]) {
  let totalRecaudado = 0;
  let totalEfectivo = 0;
  let totalYape = 0;
  let totalTarjeta = 0;
  let totalOtros = 0;

  let boletasCount = 0;
  let facturasCount = 0;
  let ticketsCount = 0;

  for (const v of ventas) {
    const monto = Number(v.monto_total) || 0;
    totalRecaudado += monto;

    const mp = (v.metodo_pago || "").toLowerCase();
    if (mp.includes("efectivo")) {
      totalEfectivo += monto;
    } else if (mp.includes("yape")) {
      totalYape += monto;
    } else if (mp.includes("tarjeta") || mp.includes("pos")) {
      totalTarjeta += monto;
    } else {
      totalOtros += monto;
    }

    const tc = (v.tipo_comprobante || "").toLowerCase();
    if (tc.includes("factura")) {
      facturasCount++;
    } else if (tc.includes("ticket")) {
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
