import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  customerFindMany: vi.fn(),
  customerFindUnique: vi.fn(),
  customerFindFirst: vi.fn(),
  customerCreate: vi.fn(),
  paymentTypeFindMany: vi.fn(),
  paymentTypeFindUnique: vi.fn(),
  salesOrderFindUnique: vi.fn(),
  salesOrderUpdate: vi.fn(),
  salesInvoiceFindFirst: vi.fn(),
  salesInvoiceFindUnique: vi.fn(),
  salesInvoiceFindMany: vi.fn(),
  salesInvoiceCreate: vi.fn(),
  salesInvoiceUpdate: vi.fn(),
  salesPaymentCreate: vi.fn(),
  diningTableUpdate: vi.fn(),
  cashSessionFindFirst: vi.fn(),
  cashSessionUpdate: vi.fn(),
  transaction: vi.fn(),
  postSaleJournalEntries: vi.fn(),
  broadcastRealtimeEvent: vi.fn(),
  getVoucherPresignedUrl: vi.fn(),
  getPrinterConfig: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
  verifyMercadoPagoWebhookSignature: vi.fn(),
  processMercadoPagoPaymentApproval: vi.fn(),
  createMercadoPagoPreference: vi.fn(),
  createOrderPreference: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: m.customerFindMany,
      findUnique: m.customerFindUnique,
      findFirst: m.customerFindFirst,
      create: m.customerCreate,
    },
    paymentType: {
      findMany: m.paymentTypeFindMany,
      findUnique: m.paymentTypeFindUnique,
    },
    salesOrder: {
      findUnique: m.salesOrderFindUnique,
      update: m.salesOrderUpdate,
    },
    salesInvoice: {
      findFirst: m.salesInvoiceFindFirst,
      findUnique: m.salesInvoiceFindUnique,
      findMany: m.salesInvoiceFindMany,
      create: m.salesInvoiceCreate,
      update: m.salesInvoiceUpdate,
    },
    salesPayment: {
      create: m.salesPaymentCreate,
    },
    diningTable: {
      update: m.diningTableUpdate,
    },
    cashSession: {
      findFirst: m.cashSessionFindFirst,
      update: m.cashSessionUpdate,
    },
    $transaction: m.transaction,
  },
}));

vi.mock("@/lib/services/accounting/accounting-posting.service", () => ({
  postSaleJournalEntries: m.postSaleJournalEntries,
}));

vi.mock("@/lib/services/integrations/s3-storage.service", () => ({
  uploadVoucherToS3: vi.fn().mockResolvedValue("https://s3.amazonaws.com/voucher.pdf"),
  uploadPaymentProofToS3: vi.fn().mockResolvedValue(null),
  buildVoucherS3Key: vi.fn().mockReturnValue("2026/11/B001-000001.pdf"),
  getS3Config: vi.fn().mockReturnValue({ endpoint: "https://s3.amazonaws.com", bucket: "test" }),
  getVoucherPresignedUrl: m.getVoucherPresignedUrl,
}));

vi.mock("@/lib/realtime/event-emitter", () => ({
  broadcastRealtimeEvent: m.broadcastRealtimeEvent,
  realtimeHub: {
    addClient: vi.fn(),
    removeClient: vi.fn(),
    getActiveClientCount: vi.fn().mockReturnValue(1),
  },
}));

vi.mock("@/lib/services/settings/restaurant-config.service", () => ({
  getPrinterConfig: m.getPrinterConfig,
}));

vi.mock("@/lib/services/integrations/mercadopago.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/integrations/mercadopago.service")>();
  return {
    ...actual,
    getMercadoPagoPayment: m.getMercadoPagoPayment,
    verifyMercadoPagoWebhookSignature: m.verifyMercadoPagoWebhookSignature,
    processMercadoPagoPaymentApproval: m.processMercadoPagoPaymentApproval,
    createMercadoPagoPreference: m.createMercadoPagoPreference,
    createOrderPreference: m.createOrderPreference,
  };
});

import { GET as getCustomers, POST as postCustomer } from "@/app/api/customers/route";
import { GET as getSales, POST as postSale } from "@/app/api/sales/route";
import { GET as getVoucherById } from "@/app/api/sales/voucher/[id]/route";
import { POST as postPreference } from "@/app/api/payments/mercadopago/preference/route";
import { GET as getPaymentStatus } from "@/app/api/payments/mercadopago/status/route";
import { POST as postWebhook } from "@/app/api/webhooks/mercadopago/route";
import { POST as postRealtime } from "@/app/api/realtime/route";

describe("Characterization: Sales, Customers, Payments & Realtime Domain Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getPrinterConfig.mockResolvedValue({
      ticketWidth: "80mm",
      autoPrint: false,
      series: {
        boleta: "B001",
        factura: "F001",
      },
    });
    m.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) =>
      cb({
        salesInvoice: {
          create: m.salesInvoiceCreate,
          update: m.salesInvoiceUpdate,
        },
        salesPayment: {
          create: m.salesPaymentCreate,
        },
        salesOrder: {
          update: m.salesOrderUpdate,
        },
        diningTable: {
          update: m.diningTableUpdate,
        },
        cashSession: {
          update: m.cashSessionUpdate,
        },
      })
    );
  });

  describe("Customers API (/api/customers)", () => {
    it("GET debe buscar clientes por término y formatear fullName y totalPurchases", async () => {
      m.customerFindMany.mockResolvedValueOnce([
        {
          id: 1,
          documentNumber: "12345678",
          firstName: "Juan",
          lastName: "Perez",
          phone: "999888777",
          personType: "Natural",
          active: true,
          _count: { salesInvoices: 3 },
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/customers?q=Juan");
      const res = await getCustomers(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0]).toMatchObject({
        documentNumber: "12345678",
        fullName: "Juan Perez",
        totalPurchases: 3,
      });
    });

    it("POST debe validar formato de DNI (8 dígitos) y crear cliente", async () => {
      m.customerFindUnique.mockResolvedValueOnce(null);
      m.customerCreate.mockResolvedValueOnce({
        id: 10,
        documentNumber: "87654321",
        firstName: "MARIA",
        lastName: "GOMEZ",
        personType: "Natural",
        phone: null,
        active: true,
      });

      const req = new NextRequest("http://localhost:3000/api/customers", {
        method: "POST",
        body: JSON.stringify({
          documentNumber: "87654321",
          firstName: "Maria",
          lastName: "Gomez",
        }),
      });

      const res = await postCustomer(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.message).toBe("Cliente registrado con éxito.");
      expect(json.customer.documentNumber).toBe("87654321");
      expect(m.customerCreate).toHaveBeenCalled();
    });

    it("POST debe rechazar DNI con longitud inválida", async () => {
      const req = new NextRequest("http://localhost:3000/api/customers", {
        method: "POST",
        body: JSON.stringify({
          documentNumber: "123",
          firstName: "Error",
        }),
      });

      const res = await postCustomer(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("El DNI debe contener exactamente 8 dígitos numéricos.");
    });
  });

  describe("Sales API (/api/sales)", () => {
    it("POST debe procesar cobro completo, cerrar comanda, liberar mesa y generar comprobante", async () => {
      m.paymentTypeFindUnique.mockResolvedValueOnce({
        id: 1,
        name: "Efectivo",
        active: true,
      });

      m.customerFindFirst.mockResolvedValueOnce({
        id: 1,
        documentNumber: "00000000",
        firstName: "CLIENTES VARIOS",
        personType: "Natural",
      });

      const mockOrder = {
        id: 50,
        code: "PED-50",
        status: "Received",
        tables: [{ table: { id: 1, number: 4 } }],
        items: [
          {
            id: 1,
            productId: 10,
            quantity: 2,
            unitPrice: 35.0,
            subtotal: 70.0,
            product: { name: "1 Pollo Entero" },
          },
        ],
      };
      m.salesOrderFindUnique.mockResolvedValueOnce(mockOrder);
      m.salesInvoiceFindFirst.mockResolvedValueOnce(null);
      m.cashSessionFindFirst.mockResolvedValueOnce({ id: 5, status: "OPEN" });

      const mockCreatedInvoice = {
        id: 201,
        voucherType: "Boleta",
        series: "B001",
        number: 1,
        totalAmount: 70.0,
        createdAt: new Date("2026-11-01T15:00:00Z"),
      };
      m.salesInvoiceCreate.mockResolvedValueOnce(mockCreatedInvoice);
      m.postSaleJournalEntries.mockResolvedValueOnce([901, 902]);

      const req = new NextRequest("http://localhost:3000/api/sales", {
        method: "POST",
        body: JSON.stringify({
          orderId: 50,
          paymentTypeId: 1,
          voucherType: "Boleta",
          amountReceived: 100,
        }),
      });

      const res = await postSale(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.message).toContain("Venta registrada");
      expect(json.invoice.fullCode).toBe("B001-00000001");
      expect(json.invoice.total).toBe(70.0);
      expect(json.invoice.change).toBe(30.0);
      expect(m.postSaleJournalEntries).toHaveBeenCalled();
      expect(m.broadcastRealtimeEvent).toHaveBeenCalledWith("PAYMENT_RECEIVED", expect.anything());
    });

    it("GET /api/sales/voucher/[id] con format=json debe retornar metadata de comprobante", async () => {
      m.salesInvoiceFindUnique.mockResolvedValueOnce({
        id: 201,
        series: "B001",
        number: 1,
        totalAmount: 70.0,
        s3Url: "https://s3.amazonaws.com/voucher.pdf",
        issuedAt: new Date("2026-11-01T15:00:00Z"),
        customer: { firstName: "Cliente", lastName: "General" },
      });
      m.getVoucherPresignedUrl.mockResolvedValueOnce("https://s3.presigned.url");

      const req = new NextRequest("http://localhost:3000/api/sales/voucher/201?format=json");
      const res = await getVoucherById(req, {
        params: Promise.resolve({ id: "201" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.invoiceCode).toBe("B001-000001");
      expect(json.total).toBe(70.0);
      expect(json.downloadUrl).toBe("https://s3.presigned.url");
    });
  });

  describe("Mercado Pago & Realtime Handlers", () => {
    it("POST /api/payments/mercadopago/preference debe generar preferencia para orden válida", async () => {
      m.salesOrderFindUnique.mockResolvedValueOnce({
        id: 10,
        code: "PED-10",
        status: "Received",
        items: [
          {
            id: 1,
            quantity: 1,
            unitPrice: 20.0,
            subtotal: 20.0,
            product: { name: "Mostrito" },
          },
        ],
      });
      m.createMercadoPagoPreference.mockResolvedValueOnce({
        preferenceId: "pref_123",
        initPoint: "https://mercadopago.com/checkout/123",
        sandboxInitPoint: "https://sandbox.mercadopago.com/checkout/123",
      });
      m.createOrderPreference.mockResolvedValueOnce({
        preferenceId: "pref_123",
        initPoint: "https://mercadopago.com/checkout/123",
        sandboxInitPoint: "https://sandbox.mercadopago.com/checkout/123",
      });

      const req = new NextRequest("http://localhost:3000/api/payments/mercadopago/preference", {
        method: "POST",
        body: JSON.stringify({ orderId: 10 }),
      });

      const res = await postPreference(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.preferenceId).toBe("pref_123");
    });

    it("POST /api/webhooks/mercadopago debe verificar firma y procesar notificación", async () => {
      m.verifyMercadoPagoWebhookSignature.mockReturnValueOnce({ isValid: true });
      m.getMercadoPagoPayment.mockResolvedValueOnce({
        id: "pay_999",
        status: "approved",
        external_reference: "PED-10",
      });
      m.processMercadoPagoPaymentApproval.mockResolvedValueOnce({
        alreadyProcessed: false,
        success: true,
        orderId: 10,
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/mercadopago?type=payment&data.id=pay_999", {
        method: "POST",
        body: JSON.stringify({ data: { id: "pay_999" } }),
      });

      const res = await postWebhook(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.orderId).toBe(10);
    });

    it("POST /api/realtime debe emitir evento a través del hub", async () => {
      const req = new NextRequest("http://localhost:3000/api/realtime", {
        method: "POST",
        body: JSON.stringify({
          type: "ORDER_CREATED",
          payload: { orderId: 123 },
        }),
      });

      const res = await postRealtime(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(m.broadcastRealtimeEvent).toHaveBeenCalledWith("ORDER_CREATED", { orderId: 123 });
    });
  });
});
