import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

// 1. Hoisted mocks para Prisma y dependencias
const {
  salesInvoiceMock,
  printerConfigMock,
  salesOrderMock,
  customerMock,
  paymentTypeMock,
  diningTableMock,
  salesPaymentMock,
  inMemoryStore,
} = vi.hoisted(() => {
  let invoices: any[] = [];
  let printerConfig: any = {
    id: "default",
    paperWidth: "80mm",
    autoCut: true,
    autoPrintVoucher: true,
    printWaiterCopy: false,
    series: {
      boleta: "B001",
      factura: "F001",
      ticket: "T001",
    },
    kitchenPrinter: { name: "Cocina", ipOrPort: "192.168.1.200:9100", active: true },
    barPrinter: { name: "Bar", ipOrPort: "192.168.1.201:9100", active: false },
    cashierPrinter: { name: "Caja", ipOrPort: "USB001 / Local", active: true },
  };

  const salesInvoiceMock = {
    findFirst: vi.fn(async ({ where, orderBy }: any) => {
      let filtered = [...invoices];
      if (where?.voucherType) {
        filtered = filtered.filter((i) => i.voucherType === where.voucherType);
      }
      if (where?.series) {
        filtered = filtered.filter((i) => i.series === where.series);
      }
      if (orderBy?.number === "desc") {
        filtered.sort((a, b) => b.number - a.number);
      }
      return filtered[0] || null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const created = {
        id: invoices.length + 1,
        ...data,
        createdAt: new Date(),
      };
      invoices.push(created);
      return created;
    }),
    findMany: vi.fn(async () => [...invoices]),
    update: vi.fn(async ({ where, data }: any) => {
      const item = invoices.find((i) => i.id === where.id);
      if (item) Object.assign(item, data);
      return item;
    }),
  };

  const printerConfigMock = {
    findUnique: vi.fn(async () => (printerConfig ? { ...printerConfig } : null)),
    create: vi.fn(async ({ data }: any) => {
      printerConfig = { ...data };
      return printerConfig;
    }),
    upsert: vi.fn(async ({ update, create }: any) => {
      if (printerConfig) {
        printerConfig = { ...printerConfig, ...update };
      } else {
        printerConfig = { ...create };
      }
      return printerConfig;
    }),
  };

  const salesOrderMock = {
    findUnique: vi.fn(async ({ where }: any) => {
      return {
        id: where.id,
        code: `PED-${where.id}`,
        status: "Served",
        tables: [{ tableId: 1, table: { id: 1, number: 1, active: false } }],
        items: [
          {
            id: 1,
            productId: 10,
            quantity: 1,
            unitPrice: 59.0,
            subtotal: 59.0,
            product: { id: 10, name: "1 Pollo a la Brasa" },
          },
        ],
      };
    }),
    update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };

  const customerMock = {
    findFirst: vi.fn(async () => ({ id: 1, documentNumber: "00000000", firstName: "CLIENTES VARIOS" })),
    create: vi.fn(async ({ data }: any) => ({ id: 2, ...data })),
  };

  const paymentTypeMock = {
    findUnique: vi.fn(async ({ where }: any) => ({
      id: where.id,
      name: "Efectivo",
      active: true,
    })),
    findMany: vi.fn(async () => [
      { id: 1, name: "Efectivo", active: true },
      { id: 2, name: "Yape", active: true },
    ]),
  };

  const diningTableMock = {
    update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };

  const salesPaymentMock = {
    create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
  };

  return {
    salesInvoiceMock,
    printerConfigMock,
    salesOrderMock,
    customerMock,
    paymentTypeMock,
    diningTableMock,
    salesPaymentMock,
    inMemoryStore: {
      getInvoices: () => invoices,
      setInvoices: (val: any[]) => {
        invoices = val;
      },
      getPrinterConfig: () => printerConfig,
      setPrinterConfig: (val: any) => {
        printerConfig = val;
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesInvoice: salesInvoiceMock,
    printerConfig: printerConfigMock,
    salesOrder: salesOrderMock,
    customer: customerMock,
    paymentType: paymentTypeMock,
    diningTable: diningTableMock,
    salesPayment: salesPaymentMock,
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === "function") {
        return cb({
          salesInvoice: salesInvoiceMock,
          salesPayment: salesPaymentMock,
          salesOrder: salesOrderMock,
          diningTable: diningTableMock,
          cashSession: { update: vi.fn() },
        });
      }
      return cb;
    }),
  },
}));

vi.mock("@/lib/services/accounting-posting.service", () => ({
  postSaleJournalEntries: vi.fn(async () => [101, 102]),
}));

vi.mock("@/lib/services/s3-storage.service", () => ({
  uploadVoucherToS3: vi.fn(async () => ({ publicUrl: "/storage/voucher.pdf" })),
  uploadPaymentProofToS3: vi.fn(async () => ({ publicUrl: "/storage/yape.jpg" })),
  buildVoucherS3Key: vi.fn(() => "boletas/2026/10/27/voucher.pdf"),
  getS3Config: vi.fn(() => ({ endpoint: "", bucket: "comprobantes", accessKey: "", secretKey: "" })),
}));

vi.mock("@/lib/realtime/event-emitter", () => ({
  broadcastRealtimeEvent: vi.fn(),
}));

import { isValidVoucherSeries, formatVoucherCode } from "@/lib/utils/series-validation";
import { POST as postSale } from "@/app/api/sales/route";
import { PUT as updatePrinters, GET as getPrinters } from "@/app/api/settings/printers/route";

function makeJsonRequest(url: string, method: string, body: any): NextRequest {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("Criterios de Aceptación: Series de comprobante configurables y correlativo por serie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryStore.setInvoices([]);
    inMemoryStore.setPrinterConfig({
      id: "default",
      paperWidth: "80mm",
      autoCut: true,
      autoPrintVoucher: true,
      printWaiterCopy: false,
      series: {
        boleta: "B001",
        factura: "F001",
        ticket: "T001",
      },
      kitchenPrinter: { name: "Cocina", ipOrPort: "192.168.1.200:9100", active: true },
      barPrinter: { name: "Bar", ipOrPort: "192.168.1.201:9100", active: false },
      cashierPrinter: { name: "Caja", ipOrPort: "USB001 / Local", active: true },
    });
  });

  describe("Criterio 1: Serie de boleta configurada B002 y correlativo propio B002-########", () => {
    it("dada la serie configurada como B002, cuando se cobra con boleta, el comprobante sale B002-######## con correlativo propio", async () => {
      // 1. Configuramos la serie de boleta a B002
      inMemoryStore.setPrinterConfig({
        id: "default",
        series: {
          boleta: "B002",
          factura: "F001",
          ticket: "T001",
        },
      });

      // 2. Simulamos que ya existían 15 comprobantes previos bajo la serie antigua B001
      inMemoryStore.setInvoices([
        { id: 1, voucherType: "Boleta", series: "B001", number: 15 },
      ]);

      // 3. Cobramos un pedido con Boleta
      const req = makeJsonRequest("http://localhost/api/sales", "POST", {
        orderId: 101,
        paymentTypeId: 1,
        voucherType: "Boleta",
        amountReceived: 60.0,
      });

      const res = await postSale(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      // Verificación de serie y correlativo propio: debe iniciar en 1 (no en 16)
      expect(json.invoice.series).toBe("B002");
      expect(json.invoice.number).toBe(1);
      // El comprobante sale con el formato SUNAT B002-######## (8 dígitos)
      expect(json.invoice.fullCode).toBe("B002-00000001");
      expect(json.invoice.fullCode).toMatch(/^B002-\d{8}$/);
    });

    it("un segundo cobro consecutivo bajo la serie B002 incrementa su correlativo propio a 2", async () => {
      inMemoryStore.setPrinterConfig({
        id: "default",
        series: {
          boleta: "B002",
          factura: "F001",
          ticket: "T001",
        },
      });

      // Primer cobro: genera B002-00000001
      const req1 = makeJsonRequest("http://localhost/api/sales", "POST", {
        orderId: 101,
        paymentTypeId: 1,
        voucherType: "Boleta",
      });
      const res1 = await postSale(req1);
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      expect(json1.invoice.fullCode).toBe("B002-00000001");

      // Segundo cobro: genera B002-00000002
      const req2 = makeJsonRequest("http://localhost/api/sales", "POST", {
        orderId: 102,
        paymentTypeId: 1,
        voucherType: "Boleta",
      });
      const res2 = await postSale(req2);
      expect(res2.status).toBe(201);
      const json2 = await res2.json();
      expect(json2.invoice.fullCode).toBe("B002-00000002");
    });
  });

  describe("Criterio 2: Validación y rechazo de series inválidas (distintas de B### o F###)", () => {
    describe("Validación unitaria con isValidVoucherSeries", () => {
      it("acepta series válidas de Boleta (B###)", () => {
        expect(isValidVoucherSeries("B001", "Boleta")).toBe(true);
        expect(isValidVoucherSeries("B002", "Boleta")).toBe(true);
        expect(isValidVoucherSeries("B999", "Boleta")).toBe(true);
      });

      it("acepta series válidas de Factura (F###)", () => {
        expect(isValidVoucherSeries("F001", "Factura")).toBe(true);
        expect(isValidVoucherSeries("F002", "Factura")).toBe(true);
        expect(isValidVoucherSeries("F999", "Factura")).toBe(true);
      });

      it("rechaza series con formato inválido", () => {
        // Longitud distinta de 4
        expect(isValidVoucherSeries("B01", "Boleta")).toBe(false);
        expect(isValidVoucherSeries("B0001", "Boleta")).toBe(false);
        expect(isValidVoucherSeries("F1", "Factura")).toBe(false);
        expect(isValidVoucherSeries("F0001", "Factura")).toBe(false);

        // Caracteres no numéricos tras el prefijo
        expect(isValidVoucherSeries("B00A", "Boleta")).toBe(false);
        expect(isValidVoucherSeries("F00X", "Factura")).toBe(false);

        // Prefijos inválidos
        expect(isValidVoucherSeries("X001", "Boleta")).toBe(false);
        expect(isValidVoucherSeries("1001", "Boleta")).toBe(false);
        expect(isValidVoucherSeries("", "Boleta")).toBe(false);
        expect(isValidVoucherSeries(null, "Boleta")).toBe(false);

        // Cruce de tipos: Factura como Boleta o viceversa
        expect(isValidVoucherSeries("F001", "Boleta")).toBe(false);
        expect(isValidVoucherSeries("B001", "Factura")).toBe(false);
      });
    });

    describe("Rechazo en la API de Configuración de Impresoras (PUT /api/settings/printers)", () => {
      it("rechaza serie de boleta inválida con 400", async () => {
        const req = makeJsonRequest("http://localhost/api/settings/printers", "PUT", {
          series: { boleta: "B01" },
        });
        const res = await updatePrinters(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/Serie de boleta inválida/i);
      });

      it("rechaza serie de factura inválida con 400", async () => {
        const req = makeJsonRequest("http://localhost/api/settings/printers", "PUT", {
          series: { factura: "INVALIDA" },
        });
        const res = await updatePrinters(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/Serie de factura inválida/i);
      });

      it("acepta series con formato válido B### y F### y las actualiza", async () => {
        const req = makeJsonRequest("http://localhost/api/settings/printers", "PUT", {
          series: { boleta: "B003", factura: "F003" },
        });
        const res = await updatePrinters(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.series.boleta).toBe("B003");
        expect(json.data.series.factura).toBe("F003");
      });
    });

    describe("Rechazo en la API de Ventas (POST /api/sales)", () => {
      it("rechaza si se envía una serie con formato inválido", async () => {
        const req = makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 101,
          paymentTypeId: 1,
          voucherType: "Boleta",
          series: "B00A",
        });
        const res = await postSale(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/Serie inválida/i);
      });

      it("rechaza si se intenta emitir Factura con serie que inicia en B", async () => {
        const req = makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 101,
          paymentTypeId: 1,
          voucherType: "Factura",
          series: "B002",
        });
        const res = await postSale(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/Serie inválida/i);
      });
    });
  });

  describe("Criterio 3: Desaparición de F001/B001 fijo en app/api/sales/route.ts", () => {
    it("verifica que el archivo app/api/sales/route.ts no contenga 'F001' ni 'B001' hardcodeados", () => {
      const routePath = path.join(process.cwd(), "app/api/sales/route.ts");
      const fileContent = fs.readFileSync(routePath, "utf-8");

      // Verificamos que no exista la asignación fija antigua
      expect(fileContent).not.toContain('"F001"');
      expect(fileContent).not.toContain('"B001"');
      expect(fileContent).not.toContain("'F001'");
      expect(fileContent).not.toContain("'B001'");
      // Verificamos que obtenga la configuración dinámicamente
      expect(fileContent).toContain("getPrinterConfig()");
    });
  });

  describe("Criterio 4: Pruebas del correlativo por serie independiente", () => {
    it("mantiene correlativos independientes para diferentes series (B001, B002, F001)", async () => {
      // 1. Configuramos B001 y emitimos 2 boletas
      inMemoryStore.setPrinterConfig({
        id: "default",
        series: { boleta: "B001", factura: "F001", ticket: "T001" },
      });

      const resB1 = await postSale(
        makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 1,
          paymentTypeId: 1,
          voucherType: "Boleta",
        })
      );
      const jsonB1 = await resB1.json();
      expect(resB1.status).toBe(201);
      expect(jsonB1.invoice.fullCode).toBe("B001-00000001");

      const resB2 = await postSale(
        makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 2,
          paymentTypeId: 1,
          voucherType: "Boleta",
        })
      );
      const jsonB2 = await resB2.json();
      expect(resB2.status).toBe(201);
      expect(jsonB2.invoice.fullCode).toBe("B001-00000002");

      // 2. Cambiamos la configuración a serie B002: el nuevo correlativo inicia en 1
      inMemoryStore.setPrinterConfig({
        id: "default",
        series: { boleta: "B002", factura: "F001", ticket: "T001" },
      });

      const resB002_1 = await postSale(
        makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 3,
          paymentTypeId: 1,
          voucherType: "Boleta",
        })
      );
      const jsonB002_1 = await resB002_1.json();
      expect(resB002_1.status).toBe(201);
      expect(jsonB002_1.invoice.fullCode).toBe("B002-00000001");

      // 3. Emitimos una Factura con serie F001: tiene su propio correlativo independiente
      const resF1 = await postSale(
        makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 4,
          paymentTypeId: 1,
          voucherType: "Factura",
          customer: {
            documentNumber: "20601234567",
            firstName: "EMPRESA GASTRONOMICA S.A.C.",
            personType: "Legal",
          },
        })
      );
      const jsonF1 = await resF1.json();
      expect(resF1.status).toBe(201);
      expect(jsonF1.invoice.fullCode).toBe("F001-00000001");

      // 4. Cambiamos la factura a serie F002: también inicia en su propio 1
      inMemoryStore.setPrinterConfig({
        id: "default",
        series: { boleta: "B002", factura: "F002", ticket: "T001" },
      });

      const resF002_1 = await postSale(
        makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 5,
          paymentTypeId: 1,
          voucherType: "Factura",
          customer: {
            documentNumber: "20601234567",
            firstName: "OTRA EMPRESA S.A.C.",
            personType: "Legal",
          },
        })
      );
      const jsonF002_1 = await resF002_1.json();
      expect(resF002_1.status).toBe(201);
      expect(jsonF002_1.invoice.fullCode).toBe("F002-00000001");

      // 5. Un siguiente comprobante de B002 continúa en 2
      const resB002_2 = await postSale(
        makeJsonRequest("http://localhost/api/sales", "POST", {
          orderId: 6,
          paymentTypeId: 1,
          voucherType: "Boleta",
        })
      );
      const jsonB002_2 = await resB002_2.json();
      expect(resB002_2.status).toBe(201);
      expect(jsonB002_2.invoice.fullCode).toBe("B002-00000002");
    });

    it("la función formatVoucherCode formatea siempre a 8 dígitos según estándar SUNAT", () => {
      expect(formatVoucherCode("B001", 1)).toBe("B001-00000001");
      expect(formatVoucherCode("B002", 45)).toBe("B002-00000045");
      expect(formatVoucherCode("F001", 99999999)).toBe("F001-99999999");
      expect(formatVoucherCode("b002", 123)).toBe("B002-00000123");
    });
  });
});
