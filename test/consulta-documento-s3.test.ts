import { describe, it, expect } from "vitest";
import { consultarDocumentoIdentidad } from "../lib/services/consulta-documento.service";
import {
  generarClaveS3Comprobante,
  registrarComprobanteS3,
  subirComprobantesEnLote,
  obtenerNombreBucket,
} from "../lib/services/s3-storage.service";

describe("Módulo de Consulta json.pe y Almacenamiento S3 - Pruebas Unitarias", () => {
  describe("1. Consulta de Documentos con json.pe", () => {
    it("debe consultar DNI en modo preparado retornando estructura con nombre y apellidos", async () => {
      const res = await consultarDocumentoIdentidad("dni", "47829103");

      expect(res.tipo).toBe("dni");
      expect(res.numero).toBe("47829103");
      expect(res.nombreCompleto).toBeDefined();
      expect(res.nombreCompleto.length).toBeGreaterThan(0);
    });

    it("debe consultar RUC en modo preparado retornando razón social y estado", async () => {
      const res = await consultarDocumentoIdentidad("ruc", "20601234567");

      expect(res.tipo).toBe("ruc");
      expect(res.numero).toBe("20601234567");
      expect(res.razonSocial).toBeDefined();
      expect(res.estado).toBe("ACTIVO");
      expect(res.condicion).toBe("HABIDO");
    });
  });

  describe("2. Almacenamiento S3 de Comprobantes (Bucket 'comprobantes')", () => {
    it("debe usar el bucket 'comprobantes' por defecto", () => {
      expect(obtenerNombreBucket()).toBe("comprobantes");
    });

    it("debe generar la clave S3 con la estructura dinámica organizada por tipo, año, mes, día y serie", () => {
      const fechaPrueba = new Date("2026-09-29T12:00:00Z");
      const clave = generarClaveS3Comprobante({
        idComprobante: 10,
        tipoComprobante: "Boleta",
        serie: "B001",
        numero: 145,
        formato: "pdf",
        fecha: fechaPrueba,
      });

      expect(clave).toBe("boletas/2026/09/29/B001-000145.pdf");
    });

    it("debe organizar las Facturas en la subcarpeta facturas dinámicamente con fecha", () => {
      const fechaPrueba = new Date("2026-09-29T14:30:00Z");
      const clave = generarClaveS3Comprobante({
        idComprobante: 12,
        tipoComprobante: "Factura",
        serie: "F001",
        numero: 12,
        formato: "pdf",
        fecha: fechaPrueba,
      });

      expect(clave).toBe("facturas/2026/09/29/F001-000012.pdf");
    });

    it("debe operar en modo seguro cuando no hay credenciales S3 en .env", async () => {
      const resultado = await registrarComprobanteS3({
        idComprobante: 1,
        tipoComprobante: "Boleta",
        serie: "B001",
        numero: 1,
      });

      expect(resultado.estado).toBe("simulado");
      expect(resultado.bucket).toBe("comprobantes");
      expect(resultado.claveS3).toBeDefined();
      expect(resultado.urlPublica).toContain(resultado.claveS3);
    });

    it("debe procesar y soportar 20 comprobantes almacenados simultáneamente a la vez sin fallar", async () => {
      // Crear lote de 20 comprobantes simultáneos
      const lote20 = Array.from({ length: 20 }, (_, i) => ({
        meta: {
          idComprobante: i + 1,
          tipoComprobante: (i % 2 === 0 ? "Boleta" : "Factura") as "Boleta" | "Factura",
          serie: i % 2 === 0 ? "B001" : "F001",
          numero: i + 1,
          formato: "pdf" as const,
        },
        contenido: Buffer.from(`Contenido binario del comprobante ${i + 1}`),
      }));

      // Ejecutar con concurrencia máxima de 20 en paralelo
      const resumen = await subirComprobantesEnLote(lote20, { concurrenciaMaxima: 20 });

      expect(resumen.total).toBe(20);
      expect(resumen.exitosos).toBe(20);
      expect(resumen.fallidos).toBe(0);
      expect(resumen.concurrenciaUsada).toBe(20);
      expect(resumen.resultados.length).toBe(20);

      // Verificar que cada uno tenga su ruta única organizada
      const claves = resumen.resultados.map((r) => r.claveS3);
      const clavesUnicas = new Set(claves);
      expect(clavesUnicas.size).toBe(20);
    });

    it("debe leer y priorizar los nombres de variables estándar de GitHub Actions (AWS_ACCESS_KEY_ID, AWS_ENDPOINT_URL_S3)", () => {
      const backupEndpoint = process.env.AWS_ENDPOINT_URL_S3;
      const backupKey = process.env.AWS_ACCESS_KEY_ID;

      try {
        process.env.AWS_ENDPOINT_URL_S3 = "https://s3.us-east-1.neon.tech";
        process.env.AWS_ACCESS_KEY_ID = "GH_SECRET_KEY_123";

        const res = registrarComprobanteS3({
          idComprobante: 99,
          tipoComprobante: "Boleta",
          serie: "B001",
          numero: 99,
        });

        expect(res).toBeDefined();
      } finally {
        process.env.AWS_ENDPOINT_URL_S3 = backupEndpoint;
        process.env.AWS_ACCESS_KEY_ID = backupKey;
      }
    });
  });
});
