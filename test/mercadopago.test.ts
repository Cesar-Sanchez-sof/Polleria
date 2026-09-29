import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  generarDeepLinkTapToPay,
  iniciarCobroMercadoPago,
  verificarFirmaWebhookMercadoPago,
} from "../lib/services/mercadopago.service";

describe("Módulo de Mercado Pago y Webhook - Pruebas Unitarias", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("debe generar un Deep Link nativo válido para Tap to Pay en el celular del mozo", () => {
    const datos = {
      idPedido: 15,
      codigoComanda: "PED-015",
      monto: 72.5,
      urlRetorno: "http://localhost:3000/ventas?tab=mesas",
    };

    const deepLink = generarDeepLinkTapToPay(datos);

    expect(deepLink).toContain("mercadopago://point/pay");
    expect(deepLink).toContain("amount=72.50");
    expect(deepLink).toContain("description=Polleria%20-%20Comanda%20PED-015");
    expect(deepLink).toContain("success_url=");
  });

  it("debe operar en modo seguro 'simulado / preparado' cuando no se ha configurado Access Token en .env", async () => {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const resultado = await iniciarCobroMercadoPago({
      idPedido: 20,
      codigoComanda: "PED-020",
      monto: 120.0,
    });

    expect(resultado.modo).toBe("tap_to_pay");
    expect(resultado.operacionId).toContain("MP-SIM");
    expect(resultado.deepLinkApp).toBeDefined();
    expect(resultado.mensaje).toContain("Mercado Pago listo");
  });

  it("debe formatear los montos en dos decimales para el esquema de cobro", () => {
    const deepLink = generarDeepLinkTapToPay({
      idPedido: 1,
      codigoComanda: "PED-001",
      monto: 45.555,
    });

    expect(deepLink).toContain("amount=45.56");
  });

  describe("Verificación de Firmas Criptográficas de Webhooks (HMAC SHA-256)", () => {
    it("debe validar en modo relajado si no hay MERCADO_PAGO_WEBHOOK_SECRET configurado", () => {
      delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;

      const resultado = verificarFirmaWebhookMercadoPago({
        xSignatureHeader: null,
        xRequestIdHeader: null,
        dataId: "123456",
      });

      expect(resultado.valida).toBe(true);
      expect(resultado.razon).toContain("no configurado");
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

      const res = verificarFirmaWebhookMercadoPago({
        xSignatureHeader: xSignature,
        xRequestIdHeader: requestId,
        dataId,
      });

      expect(res.valida).toBe(true);
    });

    it("debe rechazar una notificación con firma HMAC alterada o maliciosa", () => {
      const secret = "mi_clave_secreta_webhook_12345";
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

      const ts = Math.floor(Date.now() / 1000).toString();
      const xSignatureFalsa = `ts=${ts},v1=hash_falso_completamente_invalido`;

      const res = verificarFirmaWebhookMercadoPago({
        xSignatureHeader: xSignatureFalsa,
        xRequestIdHeader: "req-falso",
        dataId: "99887766",
      });

      expect(res.valida).toBe(false);
      expect(res.razon).toContain("no coincide");
    });
  });
});
