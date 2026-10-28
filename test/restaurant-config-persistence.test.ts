import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// 1. Hoisted mocks para Prisma y dependencias
const {
  restaurantConfigMock,
  auditLogMock,
  diningAreaMock,
  printerConfigMock,
  s3Mock,
  inMemoryStore,
} = vi.hoisted(() => {
  let inMemoryRestaurantConfig: any = null;
  let inMemoryAuditLogs: any[] = [];
  let inMemoryPrinters: any = {
    id: "default",
    paperWidth: "80mm",
    autoCut: true,
    autoPrintVoucher: true,
    printWaiterCopy: false,
    series: { boleta: "B001", factura: "F001", ticket: "T001" },
    kitchenPrinter: { name: "Cocina", ipOrPort: "192.168.1.200:9100", active: true },
    barPrinter: { name: "Bar", ipOrPort: "192.168.1.201:9100", active: false },
    cashierPrinter: { name: "Caja", ipOrPort: "USB001 / Local", active: true },
  };

  const restaurantConfigMock = {
    findUnique: vi.fn(async ({ where }: any) => {
      if (inMemoryRestaurantConfig && inMemoryRestaurantConfig.id === where.id) {
        return { ...inMemoryRestaurantConfig };
      }
      return null;
    }),
    create: vi.fn(async ({ data }: any) => {
      inMemoryRestaurantConfig = { ...data, createdAt: new Date(), updatedAt: new Date() };
      return { ...inMemoryRestaurantConfig };
    }),
    upsert: vi.fn(async ({ where, update, create }: any) => {
      if (inMemoryRestaurantConfig && inMemoryRestaurantConfig.id === where.id) {
        inMemoryRestaurantConfig = { ...inMemoryRestaurantConfig, ...update, updatedAt: new Date() };
      } else {
        inMemoryRestaurantConfig = { ...create, createdAt: new Date(), updatedAt: new Date() };
      }
      return { ...inMemoryRestaurantConfig };
    }),
  };

  const auditLogMock = {
    create: vi.fn(async ({ data }: any) => {
      const row = { id: inMemoryAuditLogs.length + 1, ...data, createdAt: new Date() };
      inMemoryAuditLogs.push(row);
      return row;
    }),
    findMany: vi.fn(async () => [...inMemoryAuditLogs]),
  };

  const diningAreaMock = {
    findMany: vi.fn(async () => []),
    createMany: vi.fn(async () => ({ count: 0 })),
  };

  const printerConfigMock = {
    findUnique: vi.fn(async () => ({ ...inMemoryPrinters })),
  };

  const s3Mock = {
    uploadYapeQrToS3: vi.fn(async ({ imageBase64 }: { imageBase64: string }) => {
      const ext = imageBase64.includes("png") ? "png" : "jpg";
      return {
        s3Key: `restaurant/yape-qr-test.${ext}`,
        publicUrl: `https://s3.neon.tech/comprobantes/restaurant/yape-qr-test.${ext}`,
      };
    }),
  };

  return {
    restaurantConfigMock,
    auditLogMock,
    diningAreaMock,
    printerConfigMock,
    s3Mock,
    inMemoryStore: {
      getRestaurantConfig: () => inMemoryRestaurantConfig,
      setRestaurantConfig: (val: any) => {
        inMemoryRestaurantConfig = val;
      },
      getAuditLogs: () => inMemoryAuditLogs,
      clearAuditLogs: () => {
        inMemoryAuditLogs = [];
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    restaurantConfig: restaurantConfigMock,
    auditLog: auditLogMock,
    diningArea: diningAreaMock,
    printerConfig: printerConfigMock,
    journalEntry: { findMany: vi.fn(async () => []) },
    salesInvoice: { findMany: vi.fn(async () => []) },
    purchaseInvoice: { findMany: vi.fn(async () => []) },
    accountingAccount: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/services/s3-storage.service", () => ({
  uploadYapeQrToS3: s3Mock.uploadYapeQrToS3,
  getS3Config: vi.fn(() => ({ endpoint: "https://s3.neon.tech", bucket: "comprobantes" })),
}));

import {
  getRestaurantInfo,
  updateRestaurantInfo,
  migrateRestaurantConfigFromJson,
  getRestaurantGlobalConfig,
} from "@/lib/services/restaurant-config.service";
import { GET as getRestaurantRoute, PUT as putRestaurantRoute } from "@/app/api/settings/restaurant/route";
import { loadPleSnapshot } from "@/lib/services/ple.service";
import { generatePleBook } from "@/lib/ple/generate";

function makeJsonRequest(url: string, method: string, body?: any): NextRequest {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe("Criterios de Aceptación: Datos del restaurante y Yape persistentes en PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryStore.clearAuditLogs();
    inMemoryStore.setRestaurantConfig({
      id: "default",
      name: "POLLERÍA & BRASAS EL BUEN SABOR S.A.C.",
      commercialName: "El Buen Sabor a la Brasa",
      ruc: "20608976543",
      address: "Av. Los Héroes 456, San Juan de Miraflores",
      city: "Lima, Perú",
      phone: "+51 987 654 321",
      email: "contacto@elbuensabor.pe",
      ticketFooter: "¡Gracias por su visita!",
      currency: "S/ PEN",
      logoUrl: "",
      yapePhone: "954316272",
      yapeName: "El Buen Sabor a la Brasa",
      yapeQrImageUrl: "https://s3.neon.tech/comprobantes/restaurant/qr-inicial.png",
    });
  });

  describe("Criterio 1: Persistencia en PostgreSQL para despliegues Vercel", () => {
    it("guarda los datos en PostgreSQL mediante Prisma y persisten al consultarlos", async () => {
      const putReq = makeJsonRequest("http://localhost/api/settings/restaurant", "PUT", {
        commercialName: "El Buen Sabor - Central Lima",
        phone: "+51 911 222 333",
        ticketFooter: "Nuevo pie de ticket guardado en PostgreSQL",
      });

      const putRes = await putRestaurantRoute(putReq);
      expect(putRes.status).toBe(200);

      expect(restaurantConfigMock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "default" },
        })
      );

      // Simula una nueva petición (incluso tras un nuevo despliegue en Vercel)
      const getRes = await getRestaurantRoute();
      expect(getRes.status).toBe(200);
      const json = await getRes.json();

      expect(json.data.commercialName).toBe("El Buen Sabor - Central Lima");
      expect(json.data.phone).toBe("+51 911 222 333");
      expect(json.data.ticketFooter).toBe("Nuevo pie de ticket guardado en PostgreSQL");
    });
  });

  describe("Criterio 2: Cambio de RUC se refleja en el nombre del archivo PLE", () => {
    it("dado que cambia el RUC, cuando se genera un PLE, el nombre del archivo usa el RUC nuevo", async () => {
      // 1. Cambiamos el RUC a un nuevo RUC oficial
      const nuevoRuc = "20999888777";
      await updateRestaurantInfo({
        ruc: nuevoRuc,
        name: "POLLERÍA & BRASAS RENOVADA S.A.C.",
      });

      // 2. Cargamos el snapshot para PLE del periodo 2026-10
      const snapshot = await loadPleSnapshot(2026, 10);
      expect(snapshot.taxpayer.ruc).toBe(nuevoRuc);

      // 3. Generamos el archivo PLE de Registro de Ventas (14.1)
      const pleResult = generatePleBook("sales-register", snapshot);

      // El nombre oficial del archivo SUNAT debe incluir el nuevo RUC
      // Formato: LE{RUC}{YYYY}{MM}00140100001111.txt
      expect(pleResult.fileName).toContain(nuevoRuc);
      expect(pleResult.fileName).toMatch(new RegExp(`^LE${nuevoRuc}20261000140100`));
    });
  });

  describe("Criterio 3: Subida de QR de Yape a S3 y visibilidad para el mozo", () => {
    it("al subir un QR en base64, se guarda como archivo en S3 y no como base64 en la base de datos", async () => {
      const mockBase64Qr = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const updated = await updateRestaurantInfo({
        yapeQrImageUrl: mockBase64Qr,
        yapePhone: "988777666",
        yapeName: "Yape Pollería El Buen Sabor",
      });

      // Se debe haber reutilizado uploadYapeQrToS3
      expect(s3Mock.uploadYapeQrToS3).toHaveBeenCalledWith({
        imageBase64: mockBase64Qr,
      });

      // El valor persistido es una URL limpia de S3, NUNCA la cadena base64
      expect(updated.yapeQrImageUrl).toBe("https://s3.neon.tech/comprobantes/restaurant/yape-qr-test.png");
      expect(updated.yapeQrImageUrl).not.toContain("data:image");

      // Verificamos que la configuración global consumida por el mozo al cobrar tenga la URL de S3
      const globalConfig = await getRestaurantGlobalConfig();
      expect(globalConfig.restaurant.yapeQrImageUrl).toBe(
        "https://s3.neon.tech/comprobantes/restaurant/yape-qr-test.png"
      );
      expect(globalConfig.restaurant.yapePhone).toBe("988777666");
    });
  });

  describe("Criterio 4: Migración de datos idempotente desde el JSON actual", () => {
    it("ejecuta la migración si la tabla está vacía, y no duplica ni sobreescribe si ya existe", async () => {
      // Caso 1: Tabla vacía -> realiza la migración
      inMemoryStore.setRestaurantConfig(null);

      const res1 = await migrateRestaurantConfigFromJson();
      expect(res1.success).toBe(true);
      expect(res1.migrated).toBe(true);
      expect(res1.restaurant.name).toBeDefined();
      expect(res1.restaurant.ruc).toBeDefined();
      expect(restaurantConfigMock.create).toHaveBeenCalled();

      // Caso 2: Segunda ejecución -> es idempotente, detecta existencia y no vuelve a crear
      const res2 = await migrateRestaurantConfigFromJson();
      expect(res2.success).toBe(true);
      expect(res2.migrated).toBe(false);
      expect(res2.restaurant.ruc).toBe(res1.restaurant.ruc);
    });
  });

  describe("Criterio 5: Cada cambio de configuración genera un registro de auditoría", () => {
    it("registra una entrada en auditLog al actualizar datos de la empresa", async () => {
      await updateRestaurantInfo(
        {
          commercialName: "Pollería El Buen Sabor Gourmet",
          phone: "+51 900 111 222",
        },
        {
          actor: { userId: 42, username: "admin_general" },
          ipAddress: "190.237.10.25",
        }
      );

      expect(auditLogMock.create).toHaveBeenCalledTimes(1);
      const auditCall = auditLogMock.create.mock.calls[0][0];

      expect(auditCall.data.action).toBe("UPDATE");
      expect(auditCall.data.module).toBe("Configuracion");
      expect(auditCall.data.entity).toBe("RestaurantConfig");
      expect(auditCall.data.entityId).toBe("default");
      expect(auditCall.data.userId).toBe(42);
      expect(auditCall.data.username).toBe("admin_general");
      expect(auditCall.data.ipAddress).toBe("190.237.10.25");
      expect(auditCall.data.description).toContain("Pollería El Buen Sabor Gourmet");
      expect(auditCall.data.details.changedFields).toEqual(
        expect.arrayContaining(["commercialName", "phone"])
      );
    });
  });

  describe("Criterio 6: Compatibilidad de interfaz para todos los consumidores", () => {
    it("mantiene soporte tanto síncrono como asíncrono para no romper ningún consumidor", async () => {
      // 1. Acceso asíncrono moderno (await)
      const asyncResult = await getRestaurantInfo();
      expect(asyncResult.ruc).toBeDefined();

      // 2. Acceso síncrono directo (compatibilidad histórica)
      const syncResult = getRestaurantInfo();
      expect(syncResult.ruc).toBeDefined();
      expect(typeof syncResult.ruc).toBe("string");
    });
  });
});
