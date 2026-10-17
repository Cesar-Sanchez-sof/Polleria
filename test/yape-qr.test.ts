import { describe, it, expect } from "vitest";
import {
  generateDynamicYapeQR,
  sanitizeYapePhone,
  calculateEmvcoCRC,
} from "../lib/utils/yape-qr";

describe("Generador de Códigos QR Dinámicos Yape (EMVCo Interoperable BCRP)", () => {
  it("debe limpiar y normalizar números de teléfono peruanos a 9 dígitos", () => {
    expect(sanitizeYapePhone("+51 987 654 321")).toBe("987654321");
    expect(sanitizeYapePhone("51-912345678")).toBe("912345678");
    expect(sanitizeYapePhone("998 877 665")).toBe("998877665");
  });

  it("debe calcular el CRC16-CCITT oficial requerido por el estándar EMVCo", () => {
    // Caso de prueba estándar EMVCo: cadena sin CRC -> CRC de 4 caracteres hexadecimales en mayúscula
    const testString = "0002010102126304";
    const crc = calculateEmvcoCRC(testString);

    expect(crc).toHaveLength(4);
    expect(/^[0-9A-F]{4}$/.test(crc)).toBe(true);
  });

  it("debe generar un payload EMVCo dinámico con el tag 01 igual a '12' (monto prefijado)", () => {
    const res = generateDynamicYapeQR({
      phone: "987654321",
      amount: 85.5,
      merchantName: "Polleria El Buen Sabor",
      orderCode: "PED-045",
    });

    // Tag 01 con longitud 02 y valor 12 (Dynamic QR)
    expect(res.emvcoPayload).toContain("010212");
    // Tag 53 con moneda 604 (Soles / PEN)
    expect(res.emvcoPayload).toContain("5303604");
    // Tag 54 con monto exacto 85.50
    expect(res.emvcoPayload).toContain("540585.50");
    // Tag 58 con país PE
    expect(res.emvcoPayload).toContain("5802PE");
    // Tag 26 con pe.yape y teléfono
    expect(res.emvcoPayload).toContain("pe.yape");
    expect(res.emvcoPayload).toContain("987654321");
    // Tag 63 de CRC al final
    expect(res.emvcoPayload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it("debe generar la URL de imagen del QR en alta resolución y el enlace directo deep link", () => {
    const res = generateDynamicYapeQR({
      phone: "+51 912-345-678",
      amount: 120.0,
      merchantName: "Brasas & Sabor",
      orderCode: "PED-099",
    });

    expect(res.amountFormatted).toBe("S/ 120.00");
    expect(res.phoneClean).toBe("912345678");
    expect(res.phoneDisplay).toBe("912 345 678");
    expect(res.qrImageUrl).toContain("https://api.qrserver.com/v1/create-qr-code");
    expect(res.qrImageUrl).toContain(encodeURIComponent("5406120.00"));
    expect(res.deepLink).toContain("yape://pay?phone=912345678&amount=120.00");
  });

  it("debe redondear adecuadamente los decimales del monto", () => {
    const res = generateDynamicYapeQR({
      phone: "987654321",
      amount: 45.6789,
    });

    expect(res.amountFormatted).toBe("S/ 45.68");
    expect(res.emvcoPayload).toContain("540545.68");
  });

  it("debe priorizar customQrImageUrl cuando el restaurante ha subido su QR oficial", () => {
    const customUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const res = generateDynamicYapeQR({
      phone: "987654321",
      amount: 50.0,
      customQrImageUrl: customUrl,
    });

    expect(res.isCustomImage).toBe(true);
    expect(res.qrImageUrl).toBe(customUrl);
  });
});
