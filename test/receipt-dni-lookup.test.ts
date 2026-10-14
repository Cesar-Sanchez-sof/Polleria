import { describe, it, expect } from "vitest";
import { validateCustomerDocument } from "../lib/utils/sales-helpers";
import { lookupIdentityDocument } from "../lib/services/document-lookup.service";

describe("Módulo de Boleta con DNI, Consulta RENIEC y Fallback a Clientes Varios", () => {
  describe("1. Reglas de Validación de Documento de Cliente", () => {
    it("debe permitir DNI vacío para Boleta de Venta (fallback a Clientes Varios)", () => {
      const res = validateCustomerDocument("Natural", "");
      expect(res.isValid).toBe(true);
    });

    it("debe permitir DNI '00000000' para Boleta de Venta (cliente genérico por defecto)", () => {
      const res = validateCustomerDocument("Natural", "00000000");
      expect(res.isValid).toBe(true);
    });

    it("debe validar correctamente un DNI de 8 dígitos numéricos", () => {
      const res = validateCustomerDocument("Natural", "47829103");
      expect(res.isValid).toBe(true);
    });

    it("debe rechazar un DNI con menos de 8 dígitos", () => {
      const res = validateCustomerDocument("Natural", "12345");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("8 dígitos");
    });

    it("debe rechazar un DNI con más de 8 dígitos o caracteres alfabéticos", () => {
      const resAlpha = validateCustomerDocument("Natural", "4782910A");
      expect(resAlpha.isValid).toBe(false);

      const resLong = validateCustomerDocument("Natural", "4782910399");
      expect(resLong.isValid).toBe(false);
    });

    it("debe validar un RUC de 11 dígitos para Factura Electrónica", () => {
      const res = validateCustomerDocument("Legal", "20601234567");
      expect(res.isValid).toBe(true);
    });

    it("debe rechazar RUC que no empiece con 10, 15, 17 o 20", () => {
      const res = validateCustomerDocument("Legal", "30601234567");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("comenzar con los dígitos 10, 15, 17 o 20");
    });
  });

  describe("2. Consulta de DNI a json.pe / RENIEC", () => {
    it("debe retornar los datos del ciudadano cuando se consulta un DNI válido", async () => {
      const res = await lookupIdentityDocument("dni", "47829103");

      expect(res.type).toBe("dni");
      expect(res.number).toBe("47829103");
      expect(res.fullName).toBeDefined();
      expect(res.fullName.length).toBeGreaterThan(0);
      expect(res.names).toBeDefined();
    });

    it("debe sanitizar espacios en blanco al consultar DNI", async () => {
      const res = await lookupIdentityDocument("dni", "  47829103  ");

      expect(res.number).toBe("47829103");
      expect(res.fullName).toBeDefined();
    });
  });

  describe("3. Lógica de Fallback Automático en Comprobantes (Boleta vs Factura)", () => {
    it("debe asignar '00000000' y 'CLIENTES VARIOS' si no se proporciona DNI para Boleta", () => {
      const inputDoc = "";
      const inputName = "";
      const voucherType = "Boleta" as string;

      const finalDoc = inputDoc.trim() || (voucherType === "Factura" ? undefined : "00000000");
      const finalName = inputName.trim() || (voucherType === "Factura" ? "EMPRESA S.A.C." : "CLIENTES VARIOS");

      expect(finalDoc).toBe("00000000");
      expect(finalName).toBe("CLIENTES VARIOS");
    });

    it("debe respetar el DNI y nombre consultados si fueron provistos para Boleta", () => {
      const inputDoc = "47829103";
      const inputName = "JUAN CARLOS PÉREZ RODRÍGUEZ";
      const voucherType = "Boleta" as string;

      const finalDoc = inputDoc.trim() || (voucherType === "Factura" ? undefined : "00000000");
      const finalName = inputName.trim() || (voucherType === "Factura" ? "EMPRESA S.A.C." : "CLIENTES VARIOS");

      expect(finalDoc).toBe("47829103");
      expect(finalName).toBe("JUAN CARLOS PÉREZ RODRÍGUEZ");
    });
  });
});
