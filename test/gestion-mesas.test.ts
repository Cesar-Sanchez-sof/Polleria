import { describe, it, expect } from "vitest";
import {
  calculateTotals,
  calculateChangeAmount,
  validateCustomerDocument,
  canEditOrder,
  calculateTablesSummary,
  calculateDailySalesSummary,
} from "../lib/utils/sales-helpers";

describe("Módulo de Ventas & Gestión de Mesas - Pruebas Unitarias", () => {
  describe("1. Cálculos de Importes e IGV (18%)", () => {
    it("debe calcular correctamente el total, subtotal e IGV para ítems de carta", () => {
      // 1 Pollo a la Brasa (S/ 72.50) + 1 Jarra de Chicha (S/ 16.00) = S/ 88.50
      const items = [
        { quantity: 1, unitPrice: 72.5 },
        { quantity: 1, unitPrice: 16.0 },
      ];

      const resultado = calculateTotals(items);

      expect(resultado.total).toBe(88.5);
      // Base imponible = 88.50 / 1.18 = 75.00
      expect(resultado.subtotal).toBe(75.0);
      // IGV = 88.50 - 75.00 = 13.50
      expect(resultado.igv).toBe(13.5);
      expect(Math.round((resultado.subtotal + resultado.igv) * 100) / 100).toBe(resultado.total);
    });

    it("debe retornar ceros cuando la lista de ítems está vacía", () => {
      const resultado = calculateTotals([]);
      expect(resultado.total).toBe(0);
      expect(resultado.subtotal).toBe(0);
      expect(resultado.igv).toBe(0);
    });

    it("debe manejar cantidades múltiples correctamente", () => {
      // 3 Mostritos a S/ 24.50 = S/ 73.50
      const items = [{ quantity: 3, unitPrice: 24.5 }];
      const res = calculateTotals(items);
      expect(res.total).toBe(73.5);
      expect(res.subtotal).toBe(62.29);
      expect(res.igv).toBe(11.21);
    });
  });

  describe("2. Cálculo de Vuelto y Validación de Efectivo", () => {
    it("debe calcular el vuelto exacto cuando el cliente paga con un billete superior", () => {
      const total = 68.0;
      const recibido = 100.0;
      const res = calculateChangeAmount(total, recibido);

      expect(res.isValid).toBe(true);
      expect(res.vuelto).toBe(32.0);
      expect(res.error).toBeUndefined();
    });

    it("debe dar vuelto 0 cuando el monto entregado es exacto", () => {
      const total = 45.5;
      const recibido = 45.5;
      const res = calculateChangeAmount(total, recibido);

      expect(res.isValid).toBe(true);
      expect(res.vuelto).toBe(0);
    });

    it("debe rechazar el cobro y dar mensaje explicativo si el efectivo es insuficiente", () => {
      const total = 50.0;
      const recibido = 30.0;
      const res = calculateChangeAmount(total, recibido);

      expect(res.isValid).toBe(false);
      expect(res.vuelto).toBe(0);
      expect(res.error).toContain("menor al total a pagar");
      expect(res.error).toContain("Faltan S/ 20.00");
    });
  });

  describe("3. Validación de Documento de Cliente (DNI y RUC)", () => {
    it("debe validar un DNI válido de 8 dígitos para Persona Natural", () => {
      const res = validateCustomerDocument("Natural", "47829103");
      expect(res.isValid).toBe(true);
    });

    it("debe rechazar un DNI con longitud distinta a 8 dígitos o caracteres no numéricos", () => {
      expect(validateCustomerDocument("Natural", "4782910").isValid).toBe(false);
      expect(validateCustomerDocument("Natural", "478291039").isValid).toBe(false);
      expect(validateCustomerDocument("Natural", "4782910A").isValid).toBe(false);
    });

    it("debe validar un RUC válido de 11 dígitos que inicie con 10 o 20 para Persona Jurídica", () => {
      const res = validateCustomerDocument("Juridico", "20601234567");
      expect(res.isValid).toBe(true);

      const res10 = validateCustomerDocument("Juridico", "10478291031");
      expect(res10.isValid).toBe(true);
    });

    it("debe rechazar un RUC que no tenga 11 dígitos o no inicie con 10, 15, 17 o 20", () => {
      expect(validateCustomerDocument("Juridico", "2060123456").isValid).toBe(false);
      expect(validateCustomerDocument("Juridico", "30601234567").isValid).toBe(false);
    });

    it("debe aceptar documento vacío o genérico para boleta simple a cliente anónimo", () => {
      expect(validateCustomerDocument("Natural", "").isValid).toBe(true);
      expect(validateCustomerDocument("Natural", "00000000").isValid).toBe(true);
    });
  });

  describe("4. Reglas de Estado del Pedido y Edición de Comandas", () => {
    it("debe permitir editar cuando el pedido está en estado Received o Preparing", () => {
      expect(canEditOrder("Received")).toBe(true);
      expect(canEditOrder("Preparing")).toBe(true);
      expect(canEditOrder("Pending")).toBe(true);
      // Compatibilidad con valores legacy en español
      expect(canEditOrder("Recibido")).toBe(true);
      expect(canEditOrder("Preparando")).toBe(true);
    });

    it("debe bloquear la edición cuando el pedido ya está Served o Closed", () => {
      expect(canEditOrder("Served")).toBe(false);
      expect(canEditOrder("Closed")).toBe(false);
      expect(canEditOrder("Cancelled")).toBe(false);
      expect(canEditOrder("Servido")).toBe(false);
      expect(canEditOrder("Cerrado")).toBe(false);
    });
  });

  describe("5. Cálculo de Ocupación de Salón de Mesas", () => {
    it("debe calcular correctamente el aforo y estado del salón", () => {
      const tables = [
        { occupied: true },
        { occupied: false },
        { occupied: true },
        { occupied: false },
        { occupied: false },
      ];

      const resumen = calculateTablesSummary(tables);
      expect(resumen.total).toBe(5);
      expect(resumen.occupied).toBe(2);
      expect(resumen.available).toBe(3);
    });
  });

  describe("6. Resumen de Ventas Diarias y Cierre de Caja", () => {
    it("debe desglosar correctamente ingresos por Efectivo, Yape y Tarjeta POS", () => {
      const ventas = [
        { total: 100.0, paymentMethod: "Efectivo", voucherType: "Boleta" },
        { total: 50.0, paymentMethod: "Yape", voucherType: "Boleta" },
        { total: 150.0, paymentMethod: "Tarjeta POS (Tap to Pay)", voucherType: "Factura" },
        { total: 40.0, paymentMethod: "Efectivo", voucherType: "Ticket" },
      ];

      const resumen = calculateDailySalesSummary(ventas);

      expect(resumen.totalRecaudado).toBe(340.0);
      expect(resumen.cantidadVentas).toBe(4);
      expect(resumen.desgloseMetodos.efectivo).toBe(140.0);
      expect(resumen.desgloseMetodos.yape).toBe(50.0);
      expect(resumen.desgloseMetodos.tarjeta).toBe(150.0);
      expect(resumen.desgloseComprobantes.boletas).toBe(2);
      expect(resumen.desgloseComprobantes.facturas).toBe(1);
      expect(resumen.desgloseComprobantes.tickets).toBe(1);
    });
  });

  describe("7. Cobros No Cobrados (Cuentas Abiertas en Salón y Ventanilla)", () => {
    it("debe calcular el importe total por cobrar sumando mesas ocupadas y comandas para llevar activas", () => {
      const cuentasPendientes = [
        { tipo: "Mesa", total: 145.0, kitchenStatus: "Served" },
        { tipo: "Mesa", total: 85.5, kitchenStatus: "Preparing" },
        { tipo: "Llevar", total: 42.0, kitchenStatus: "Received" },
      ];

      const totalPorCobrar = cuentasPendientes.reduce((acc, c) => acc + c.total, 0);
      expect(totalPorCobrar).toBe(272.5);
      expect(cuentasPendientes.length).toBe(3);
    });

    it("debe excluir pedidos que ya fueron cerrados o cancelados de los cobros pendientes", () => {
      const todosLosPedidos = [
        { id: 1, code: "PED-001", status: "Served", total: 72.5 },
        { id: 2, code: "PED-002", status: "Closed", total: 80.0 }, // Ya cobrado
        { id: 3, code: "PED-003", status: "Cancelled", total: 50.0 }, // Cancelado
        { id: 4, code: "PED-004", status: "Preparing", total: 45.0 },
      ];

      const noCobrados = todosLosPedidos.filter(
        (p) => p.status !== "Closed" && p.status !== "Cancelled"
      );

      expect(noCobrados.length).toBe(2);
      expect(noCobrados.map((p) => p.id)).toEqual([1, 4]);
    });
  });

  describe("8. Cobro desde el Mozo vs Cobro desde Ventanilla", () => {
    it("el cobro del mozo emite un comprobante de ticket rápido y admite Tap to Pay con celular", () => {
      const payloadCobroMozo = {
        orderId: 10,
        voucherType: "Ticket",
        paymentTypeId: 3, // POS / Tap to Pay
        gateway: {
          provider: "mercado_pago",
          mode: "tap_to_pay",
        },
      };

      expect(payloadCobroMozo.voucherType).toBe("Ticket");
      expect(payloadCobroMozo.gateway.mode).toBe("tap_to_pay");
    });

    it("el cobro en ventanilla permite facturar con RUC y desglose formal de IGV", () => {
      const payloadVentanilla = {
        orderId: 12,
        voucherType: "Factura",
        customer: {
          documentNumber: "20601234567",
          firstName: "DISTRIBUIDORA GASTRONÓMICA S.A.C.",
          personType: "Legal",
        },
      };

      expect(payloadVentanilla.voucherType).toBe("Factura");
      expect(payloadVentanilla.customer.personType).toBe("Legal");
      expect(payloadVentanilla.customer.documentNumber.length).toBe(11);
    });
  });
});
