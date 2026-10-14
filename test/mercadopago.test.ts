import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import {
  generateTapToPayDeepLink,
  startMercadoPagoCharge,
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  searchMercadoPagoPaymentsByOrder,
  verifyMercadoPagoWebhookSignature,
  processMercadoPagoPaymentApproval,
} from "../lib/services/mercadopago.service";
import { prisma } from "../lib/prisma";
import { realtimeHub } from "../lib/realtime/event-emitter";
import { GET as statusGET } from "../app/api/payments/mercadopago/status/route";
import { POST as preferencePOST } from "../app/api/payments/mercadopago/preference/route";
import { POST as webhookPOST } from "../app/api/webhooks/mercadopago/route";
import { NextRequest } from "next/server";

describe("Módulo de Mercado Pago - Pruebas Unitarias y de Integración", () => {
  const envBackup = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...envBackup };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = envBackup;
    global.fetch = originalFetch;
  });

  describe("Deep Links Tap to Pay y Esquema Móvil", () => {
    it("debe generar un Deep Link nativo válido para Tap to Pay en el celular del mozo", () => {
      const datos = {
        idPedido: 15,
        codigoComanda: "PED-015",
        monto: 72.5,
        urlRetorno: "http://localhost:3000/sales?tab=tables",
      };

      const deepLink = generateTapToPayDeepLink(datos);

      expect(deepLink).toContain("mercadopago://point/pay");
      expect(deepLink).toContain("amount=72.50");
      expect(deepLink).toContain("description=Polleria%20-%20Comanda%20PED-015");
      expect(deepLink).toContain("success_url=");
    });

    it("debe redondear y formatear los montos con exactamente 2 decimales para Tap to Pay", () => {
      const deepLink = generateTapToPayDeepLink({
        idPedido: 1,
        codigoComanda: "PED-001",
        monto: 45.555,
      });

      expect(deepLink).toContain("amount=45.56");
    });
  });

  describe("Inicio de Cobro (startMercadoPagoCharge)", () => {
    it("debe operar en modo seguro simulado cuando no se ha configurado Access Token en .env", async () => {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      const resultado = await startMercadoPagoCharge({
        idPedido: 20,
        codigoComanda: "PED-020",
        monto: 120.0,
      });

      expect(resultado.modo).toBe("tap_to_pay");
      expect(resultado.operacionId).toContain("MP-SIM");
      expect(resultado.deepLinkApp).toBeDefined();
      expect(resultado.estado).toBe("simulado");
    });

    it("debe generar operacionId en vivo y deep link cuando hay un token configurado", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-TOKEN-123456789";
      const resultado = await startMercadoPagoCharge({
        idPedido: 22,
        codigoComanda: "PED-022",
        monto: 85.0,
      });

      expect(resultado.modo).toBe("tap_to_pay");
      expect(resultado.operacionId).toContain("MP-LIVE");
      expect(resultado.estado).toBe("pendiente");
      expect(resultado.deepLinkApp).toContain("amount=85.00");
    });
  });

  describe("Creación de Preferencias y QR (Checkout Pro)", () => {
    it("debe retornar preferencia simulada cuando no hay token configurado", async () => {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;

      const res = await createMercadoPagoPreference({
        idPedido: 30,
        codigoComanda: "PED-030",
        monto: 150.0,
      });

      expect(res.isSimulated).toBe(true);
      expect(res.preferenceId).toContain("PREF-SIM");
      expect(res.initPoint).toBeDefined();
      expect(res.sandboxInitPoint).toBeDefined();
    });

    it("debe invocar la API de Mercado Pago cuando hay token y retornar URLs de Checkout y Sandbox", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-TOKEN-VALIDO";

      const mockResponse = {
        id: "PREF-MP-REAL-9999",
        init_point: "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=9999",
        sandbox_init_point: "https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=9999",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const res = await createMercadoPagoPreference({
        idPedido: 35,
        codigoComanda: "PED-035",
        monto: 99.9,
      });

      expect(res.isSimulated).toBe(false);
      expect(res.preferenceId).toBe("PREF-MP-REAL-9999");
      expect(res.initPoint).toBe(mockResponse.init_point);
      expect(res.sandboxInitPoint).toBe(mockResponse.sandbox_init_point);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/checkout/preferences",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer TEST-TOKEN-VALIDO",
          }),
        })
      );
    });
  });

  describe("Consulta de Pagos en API de Mercado Pago", () => {
    it("debe retornar estado simulado si no hay token configurado", async () => {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      const payment = await getMercadoPagoPayment("12345");
      expect(payment.status).toBe("approved");
      expect(payment.status_detail).toBe("simulated_without_token");
    });

    it("debe consultar a api.mercadopago.com/v1/payments si el token existe", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-TOKEN-VALIDO";
      const mockPayment = {
        id: 778899,
        status: "approved",
        status_detail: "accredited",
        transaction_amount: 110.5,
        external_reference: "PED-45",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPayment,
      } as any);

      const res = await getMercadoPagoPayment(778899);
      expect(res).toEqual(mockPayment);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/v1/payments/778899",
        expect.objectContaining({
          headers: { Authorization: "Bearer TEST-TOKEN-VALIDO" },
        })
      );
    });

    it("debe buscar pagos por external_reference (PED-{orderId})", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-TOKEN-VALIDO";
      const mockSearchResults = {
        results: [
          {
            id: 889900,
            status: "approved",
            external_reference: "PED-50",
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSearchResults,
      } as any);

      const results = await searchMercadoPagoPaymentsByOrder(50);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(889900);
    });
  });

  describe("Verificación de Firmas Criptográficas de Webhooks (HMAC SHA-256)", () => {
    it("debe validar en modo relajado si no hay MERCADO_PAGO_WEBHOOK_SECRET configurado", () => {
      delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;

      const resultado = verifyMercadoPagoWebhookSignature({
        xSignatureHeader: null,
        xRequestIdHeader: null,
        dataId: "123456",
      });

      expect(resultado.isValid).toBe(true);
      expect(resultado.reason).toContain("no configurado");
    });

    it("debe verificar exitosamente una firma legítima de Mercado Pago con el secret configurado", () => {
      const secret = "mi_clave_secreta_webhook_12345";
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

      const dataId = "99887766";
      const requestId = "req-uuid-abc-123";
      const ts = Math.floor(Date.now() / 1000).toString();

      // Construcción del manifiesto oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const hashValido = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

      const xSignature = `ts=${ts},v1=${hashValido}`;

      const res = verifyMercadoPagoWebhookSignature({
        xSignatureHeader: xSignature,
        xRequestIdHeader: requestId,
        dataId,
      });

      expect(res.isValid).toBe(true);
    });

    it("debe rechazar una notificación con firma HMAC alterada o maliciosa", () => {
      const secret = "mi_clave_secreta_webhook_12345";
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

      const ts = Math.floor(Date.now() / 1000).toString();
      const xSignatureFalsa = `ts=${ts},v1=hash_falso_completamente_invalido`;

      const res = verifyMercadoPagoWebhookSignature({
        xSignatureHeader: xSignatureFalsa,
        xRequestIdHeader: "req-falso",
        dataId: "99887766",
      });

      expect(res.isValid).toBe(false);
      expect(res.reason).toContain("no coincide");
    });

    it("debe rechazar una notificación expirada con timestamp mayor a 10 minutos", () => {
      const secret = "mi_clave_secreta_webhook_12345";
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

      // 15 minutos en el pasado
      const tsViejo = (Math.floor(Date.now() / 1000) - 900).toString();
      const manifest = `id:123;request-id:req-123;ts:${tsViejo};`;
      const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

      const res = verifyMercadoPagoWebhookSignature({
        xSignatureHeader: `ts=${tsViejo},v1=${hash}`,
        xRequestIdHeader: "req-123",
        dataId: "123",
      });

      expect(res.isValid).toBe(false);
      expect(res.reason).toContain("expirada");
    });
  });

  describe("Procesamiento Atómico e Idempotente de Cobro (processMercadoPagoPaymentApproval)", () => {
    it("debe responder con alreadyProcessed: true si el pedido ya fue cerrado previamente", async () => {
      const mockOrder = {
        id: 77,
        code: "PED-077",
        status: "Closed",
        tables: [],
        items: [],
      };

      const mockExistingInvoice = {
        id: 101,
        voucherType: "Boleta",
        series: "B001",
        number: 45,
        totalAmount: 80.0,
      };

      vi.spyOn(prisma.salesOrder, "findUnique").mockResolvedValue(mockOrder as any);
      vi.spyOn(prisma.salesInvoice, "findFirst").mockResolvedValue(mockExistingInvoice as any);

      const result = await processMercadoPagoPaymentApproval("MP-PAGO-123", 77);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
      expect(result.invoice?.fullCode).toBe("B001-000045");
      expect(result.message).toContain("cerrado y procesado previamente");
    });

    it("debe rechazar si el pedido no existe en la base de datos", async () => {
      vi.spyOn(prisma.salesOrder, "findUnique").mockResolvedValue(null);

      const result = await processMercadoPagoPaymentApproval("MP-PAGO-999", 999);

      expect(result.success).toBe(false);
      expect(result.alreadyProcessed).toBe(false);
      expect(result.message).toContain("no fue encontrado");
    });

    it("debe procesar exitosamente un pedido pendiente, emitir comprobante B001 y emitir eventos en tiempo real", async () => {
      const mockOrder = {
        id: 88,
        code: "PED-088",
        status: "Received",
        tables: [{ id: 1, tableId: 5, notes: null, table: { id: 5, number: 5 } }],
        items: [
          { id: 1, dishId: 2, quantity: 1, unitPrice: 59.0, subtotal: 59.0 },
          { id: 2, dishId: 4, quantity: 2, unitPrice: 10.0, subtotal: 20.0 },
        ],
      };

      const mockPaymentType = { id: 3, name: "Mercado Pago" };
      const mockCustomer = { id: 1, documentNumber: "00000000", firstName: "CLIENTES VARIOS" };
      const mockLastInvoice = { number: 12 };

      vi.spyOn(prisma.salesOrder, "findUnique").mockResolvedValue(mockOrder as any);
      vi.spyOn(prisma.paymentType, "findFirst").mockResolvedValue(mockPaymentType as any);
      vi.spyOn(prisma.customer, "findFirst").mockResolvedValue(mockCustomer as any);
      vi.spyOn(prisma.salesInvoice, "findFirst").mockResolvedValue(mockLastInvoice as any);

      // Espiar el hub de eventos en tiempo real
      const realtimeSpy = vi.spyOn(realtimeHub, "broadcast");

      // Mock de la transacción de prisma
      const mockCreatedInvoice = {
        id: 205,
        voucherType: "Boleta",
        series: "B001",
        number: 13,
        subtotal: 66.95,
        igv: 12.05,
        totalAmount: 79.0,
        status: "Issued",
        issuedAt: new Date(),
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
        const tx = {
          salesInvoice: { create: vi.fn().mockResolvedValue(mockCreatedInvoice) },
          salesPayment: { create: vi.fn().mockResolvedValue({ id: 1 }) },
          salesOrder: { update: vi.fn().mockResolvedValue({ id: 88, status: "Closed" }) },
          diningTable: {
            update: vi.fn().mockResolvedValue({ id: 5, active: true }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          accountingAccount: {
            findMany: vi.fn().mockResolvedValue([
              { id: 10, code: "1212" },
              { id: 11, code: "40111" },
              { id: 12, code: "70121" },
              { id: 13, code: "1041" },
            ]),
            upsert: vi.fn().mockImplementation(async ({ create }) => ({
              id: 99,
              code: create?.code || "101",
            })),
          },
          accountingPeriod: {
            findFirst: vi.fn().mockResolvedValue({ id: 1, isClosed: false }),
          },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ id: 99 }),
          },
          journalEntryLine: {
            createMany: vi.fn().mockResolvedValue({ count: 4 }),
          },
        };
        return cb(tx);
      });

      const result = await processMercadoPagoPaymentApproval("MP-REAL-555", 88);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
      expect(result.invoice?.fullCode).toBe("B001-000013");
      expect(result.invoice?.totalAmount).toBe(79.0);

      // Verificar que se emitieron eventos en tiempo real
      expect(realtimeSpy).toHaveBeenCalledWith(
        "PAYMENT_RECEIVED",
        expect.objectContaining({ orderId: 88, total: 79.0, paymentMethod: "Mercado Pago" }),
        undefined
      );
      expect(realtimeSpy).toHaveBeenCalledWith(
        "TABLE_UPDATED",
        expect.objectContaining({ reason: "PAGO_COMPLETADO", orderId: 88 }),
        undefined
      );
      expect(realtimeSpy).toHaveBeenCalledWith(
        "MERCADO_PAGO_APPROVED",
        expect.objectContaining({ orderId: 88, orderCode: "PED-088" }),
        undefined
      );
    });
  });

  describe("Endpoints API de Mercado Pago", () => {
    describe("POST /api/payments/mercadopago/preference", () => {
      it("debe retornar error 400 si falta el orderId", async () => {
        const req = new NextRequest("http://localhost:3000/api/payments/mercadopago/preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        const res = await preferencePOST(req);
        expect(res.status).toBe(400);
      });

      it("debe generar la preferencia con URLs de pago y QR para una orden válida", async () => {
        vi.spyOn(prisma.salesOrder, "findUnique").mockResolvedValue({
          id: 42,
          code: "PED-042",
          status: "Received",
          items: [
            { id: 1, quantity: 1, unitPrice: 65.0, subtotal: 65.0, dish: { name: "1 Pollo" } },
          ],
        } as any);

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            id: "PREF-TEST-42",
            init_point: "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=42",
            sandbox_init_point: "https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=42",
          }),
        } as any);

        const req = new NextRequest("http://localhost:3000/api/payments/mercadopago/preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: 42 }),
        });

        const res = await preferencePOST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.orderId).toBe(42);
        expect(json.total).toBe(65.0);
        expect(json.initPoint).toBeDefined();
      });
    });

    describe("GET /api/payments/mercadopago/status", () => {
      it("debe rechazar la consulta si no se envía orderId", async () => {
        const req = new NextRequest("http://localhost:3000/api/payments/mercadopago/status", {
          method: "GET",
        });

        const res = await statusGET(req);
        expect(res.status).toBe(400);
      });

      it("debe responder inmediatamente si la comanda ya está cerrada", async () => {
        vi.spyOn(prisma.salesOrder, "findUnique").mockResolvedValue({
          id: 50,
          status: "Closed",
          tables: [],
          items: [],
        } as any);

        vi.spyOn(prisma.salesInvoice, "findFirst").mockResolvedValue({
          id: 301,
          voucherType: "Boleta",
          series: "B001",
          number: 89,
          totalAmount: 95.0,
        } as any);

        const req = new NextRequest("http://localhost:3000/api/payments/mercadopago/status?orderId=50", {
          method: "GET",
        });

        const res = await statusGET(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.status).toBe("approved");
        expect(json.alreadyProcessed).toBe(true);
        expect(json.invoice.fullCode).toBe("B001-000089");
      });
    });

    describe("POST /api/webhooks/mercadopago", () => {
      it("debe responder 200 con mensaje si el webhook llega sin payment ID", async () => {
        const req = new NextRequest("http://localhost:3000/api/webhooks/mercadopago", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        const res = await webhookPOST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.message).toContain("sin ID de pago");
      });

      it("debe rechazar con 401 si la firma HMAC es inválida", async () => {
        process.env.MERCADO_PAGO_WEBHOOK_SECRET = "mi_secreto_webhook";
        const currentTs = Math.floor(Date.now() / 1000).toString();

        const req = new NextRequest("http://localhost:3000/api/webhooks/mercadopago", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-signature": `ts=${currentTs},v1=hash_falso_invalido`,
            "x-request-id": "req-fake",
          },
          body: JSON.stringify({ data: { id: "123456" } }),
        });

        const res = await webhookPOST(req);
        expect(res.status).toBe(401);
      });
    });
  });
});
