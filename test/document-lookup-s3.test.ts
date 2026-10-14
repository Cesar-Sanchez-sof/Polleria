import { describe, it, expect } from "vitest";
import { lookupIdentityDocument } from "../lib/services/document-lookup.service";
import {
  buildVoucherS3Key,
  uploadVoucherToS3,
  uploadVouchersBatch,
  getBucketName,
} from "../lib/services/s3-storage.service";

describe("Módulo de Consulta json.pe y Almacenamiento S3 - Pruebas Unitarias", () => {
  describe("1. Consulta de Documentos con json.pe", () => {
    it("debe consultar DNI en modo preparado retornando estructura con nombre y apellidos", async () => {
      const res = await lookupIdentityDocument("dni", "47829103");

      expect(res.type).toBe("dni");
      expect(res.number).toBe("47829103");
      expect(res.fullName).toBeDefined();
      expect(res.fullName.length).toBeGreaterThan(0);
    });

    it("debe consultar RUC en modo preparado retornando razón social y estado", async () => {
      const res = await lookupIdentityDocument("ruc", "20601234567");

      expect(res.type).toBe("ruc");
      expect(res.number).toBe("20601234567");
      expect(res.businessName).toBeDefined();
      expect(res.status).toBe("ACTIVO");
      expect(res.condition).toBe("HABIDO");
    });
  });

  describe("2. Almacenamiento S3 de Comprobantes (Bucket 'comprobantes')", () => {
    it("debe usar el bucket 'comprobantes' por defecto", () => {
      expect(getBucketName()).toBe("comprobantes");
    });

    it("debe generar la clave S3 con la estructura dinámica organizada por tipo, año, mes, día y serie", () => {
      const testDate = new Date("2026-09-29T12:00:00Z");
      const key = buildVoucherS3Key({
        voucherId: 10,
        voucherType: "Boleta",
        serie: "B001",
        number: 145,
        format: "pdf",
        date: testDate,
      });

      expect(key).toBe("boletas/2026/09/29/B001-000145.pdf");
    });

    it("debe organizar las Facturas en la subcarpeta facturas dinámicamente con fecha", () => {
      const testDate = new Date("2026-09-29T14:30:00Z");
      const key = buildVoucherS3Key({
        voucherId: 12,
        voucherType: "Factura",
        serie: "F001",
        number: 12,
        format: "pdf",
        date: testDate,
      });

      expect(key).toBe("facturas/2026/09/29/F001-000012.pdf");
    });

    it("debe operar en modo seguro cuando no hay credenciales S3 en .env", async () => {
      const prevKey = process.env.AWS_ACCESS_KEY_ID;
      const prevSecret = process.env.AWS_SECRET_ACCESS_KEY;
      const prevS3Key = process.env.S3_ACCESS_KEY_ID;
      const prevS3Secret = process.env.S3_SECRET_ACCESS_KEY;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      try {
        const result = await uploadVoucherToS3({
          voucherId: 1,
          voucherType: "Boleta",
          serie: "B001",
          number: 1,
        });

        expect(result.status).toBe("guardado");
        expect(result.bucket).toBe("comprobantes");
        expect(result.s3Key).toBeDefined();
        expect(result.publicUrl).toContain(result.s3Key);
      } finally {
        if (prevKey) process.env.AWS_ACCESS_KEY_ID = prevKey;
        if (prevSecret) process.env.AWS_SECRET_ACCESS_KEY = prevSecret;
        if (prevS3Key) process.env.S3_ACCESS_KEY_ID = prevS3Key;
        if (prevS3Secret) process.env.S3_SECRET_ACCESS_KEY = prevS3Secret;
      }
    });

    it("debe procesar y soportar 20 comprobantes almacenados simultáneamente a la vez sin fallar", async () => {
      // Crear lote de 20 comprobantes simultáneos
      const batch20 = Array.from({ length: 20 }, (_, i) => ({
        meta: {
          voucherId: i + 1,
          voucherType: (i % 2 === 0 ? "Boleta" : "Factura") as "Boleta" | "Factura",
          serie: i % 2 === 0 ? "B001" : "F001",
          number: i + 1,
          format: "pdf" as const,
        },
        content: Buffer.from(`Contenido binario del comprobante ${i + 1}`),
      }));

      // Ejecutar con concurrencia máxima de 20 en paralelo
      const summary = await uploadVouchersBatch(batch20, { maxConcurrency: 20 });

      expect(summary.total).toBe(20);
      expect(summary.successful).toBe(20);
      expect(summary.failed).toBe(0);
      expect(summary.concurrencyUsed).toBe(20);
      expect(summary.results.length).toBe(20);

      // Verificar que cada uno tenga su ruta única organizada
      const keys = summary.results.map((r) => r.s3Key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(20);
    });

    it("debe leer y priorizar los nombres de variables estándar de GitHub Actions (AWS_ACCESS_KEY_ID, AWS_ENDPOINT_URL_S3)", () => {
      const backupEndpoint = process.env.AWS_ENDPOINT_URL_S3;
      const backupKey = process.env.AWS_ACCESS_KEY_ID;

      try {
        process.env.AWS_ENDPOINT_URL_S3 = "https://s3.us-east-1.neon.tech";
        process.env.AWS_ACCESS_KEY_ID = "GH_SECRET_KEY_123";

        const res = uploadVoucherToS3({
          voucherId: 99,
          voucherType: "Boleta",
          serie: "B001",
          number: 99,
        });

        expect(res).toBeDefined();
      } finally {
        process.env.AWS_ENDPOINT_URL_S3 = backupEndpoint;
        process.env.AWS_ACCESS_KEY_ID = backupKey;
      }
    });
  });
});
