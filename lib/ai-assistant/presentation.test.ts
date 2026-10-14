import { describe, expect, it } from "vitest";
import { parseQueryResponse } from "@/lib/ai-assistant/contract";
import { formatPen, periodText, toAssistantReply } from "@/lib/ai-assistant/presentation";
import { assistantRoleFor, readAssistantConfig } from "@/lib/ai-assistant/config";

const TOKEN = "cd".repeat(32);

describe("formato de importes en soles", () => {
  it("coincide con el formato del backend y no usa coma flotante", () => {
    expect(formatPen("1149.60")).toBe("S/ 1,149.60");
    expect(formatPen("1234567.5")).toBe("S/ 1,234,567.50");
    expect(formatPen("0")).toBe("S/ 0.00");
    expect(formatPen("-0.00")).toBe("S/ 0.00");
    expect(formatPen("-650.4")).toBe("-S/ 650.40");
    expect(formatPen("0.10")).toBe("S/ 0.10");
    expect(formatPen("9007199254740993.01")).toBe("S/ 9,007,199,254,740,993.01"); // sin pérdida de precisión
  });

  it("no redondea por su cuenta", () => {
    expect(() => formatPen("1.005")).toThrow();
    expect(() => formatPen("abc")).toThrow();
    expect(formatPen("1.500")).toBe("S/ 1.50");
  });
});

describe("texto del período", () => {
  it("mes completo o rango", () => {
    expect(periodText("2026-09-01", "2026-09-30")).toBe("septiembre de 2026");
    expect(periodText("2028-02-01", "2028-02-29")).toBe("febrero de 2028");
    expect(periodText("2026-09-01", "2026-09-15")).toBe("del 01/09/2026 al 15/09/2026");
    expect(periodText("2026-07-01", "2026-09-30")).toBe("del 01/07/2026 al 30/09/2026");
  });
});

describe("contrato y presentación", () => {
  const base = {
    id_traza: "traza-0001",
    estado: "respondida",
    texto: "Durante septiembre de 2026, los movimientos de Bancos tuvieron un saldo neto de S/ 1,900.00.",
    cifras: [
      { marcador: "c1", valor: "1900.00", unidad: "PEN", origen: "motor" },
      { marcador: "c2", valor: "4100.00", unidad: "PEN", origen: "executor" },
    ],
    evidencias: [],
    versiones: {},
    detalle: {
      tipo: "saldo_cuenta",
      cuenta: "104",
      cuenta_nombre: null,
      periodo: { desde: "2026-09-01", hasta: "2026-09-30" },
      etiquetas: [
        { marcador: "c1", etiqueta: "Saldo neto de los movimientos del período" },
        { marcador: "c2", etiqueta: "Total del debe (cargos)" },
      ],
      nota: null,
    },
  };

  it("el detalle solo usa cifras verificadas del backend", () => {
    const reply = toAssistantReply(parseQueryResponse(base)!);
    expect(reply.detalle).toEqual({
      cuenta: "Cuenta 104",
      periodo: "septiembre de 2026",
      filas: [
        { etiqueta: "Saldo neto de los movimientos del período", valor: "S/ 1,900.00" },
        { etiqueta: "Total del debe (cargos)", valor: "S/ 4,100.00" },
      ],
      nota: null,
    });
  });

  it("rechaza respuestas fuera del contrato", () => {
    const invalid = [
      { ...base, estado: "inventado" },
      { ...base, sorpresa: true },
      { ...base, id_traza: "x" },
      { ...base, cifras: [{ ...base.cifras[0], valor: 1900 }] },
      { ...base, cifras: [base.cifras[0], base.cifras[0]] },
      { ...base, detalle: { ...base.detalle, etiquetas: [base.detalle.etiquetas[0]] } },
      { ...base, estado: "sin_datos" },
      { ...base, detalle: { ...base.detalle, cuenta: "caja" } },
      { ...base, detalle: { ...base.detalle, extra: 1 } },
      null,
      [],
    ];
    for (const value of invalid) expect(parseQueryResponse(value)).toBeNull();
  });

  it("acepta respuestas sin detalle (compatibilidad)", () => {
    const withoutDetail: Record<string, unknown> = { ...base, estado: "sin_datos", cifras: [] };
    delete withoutDetail.detalle;
    const parsed = parseQueryResponse(withoutDetail);
    expect(parsed?.detalle).toBeNull();
    expect(toAssistantReply(parsed!).detalle).toBeNull();
  });
});

describe("configuración del modo demostración", () => {
  const env = { AI_ASSISTANT_DEMO: "1", AI_SERVICE_URL: "http://127.0.0.1:8001", AI_SERVICE_INTERNAL_TOKEN: TOKEN };

  it("solo se activa de forma explícita y local", () => {
    expect(readAssistantConfig({ ...env, NODE_ENV: "development" })).toMatchObject({ enabled: true, demo: true });
    expect(readAssistantConfig({ ...env, NODE_ENV: "production" })).toEqual({ enabled: false, reason: "production" });
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_DEMO: undefined })).toEqual({ enabled: false, reason: "disabled" });
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_DEMO: "true" })).toEqual({ enabled: false, reason: "disabled" });
    for (const url of ["http://localhost:8001", "http://0.0.0.0:8001", "https://127.0.0.1:8001", "http://127.0.0.1:80", "http://127.0.0.1:8001/v1"]) {
      expect(readAssistantConfig({ ...env, AI_SERVICE_URL: url })).toEqual({ enabled: false, reason: "misconfigured" });
    }
    for (const token of ["", "corto", "zz".repeat(32)]) {
      expect(readAssistantConfig({ ...env, AI_SERVICE_INTERNAL_TOKEN: token })).toEqual({ enabled: false, reason: "misconfigured" });
    }
  });

  it("datos reales solo con clave de identidad independiente (P-9)", () => {
    const identity = "ab".repeat(32);
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_REAL_DATA: "1" })).toEqual({ enabled: false, reason: "misconfigured" });
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_REAL_DATA: "1", AI_ASSISTANT_IDENTITY_KEY: identity })).toMatchObject({
      enabled: true, realData: true, identityKey: identity,
    });
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_IDENTITY_KEY: TOKEN })).toEqual({ enabled: false, reason: "misconfigured" });
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_IDENTITY_KEY: "corta" })).toEqual({ enabled: false, reason: "misconfigured" });
    expect(readAssistantConfig({ ...env, AI_ASSISTANT_REAL_DATA: "1", AI_ASSISTANT_IDENTITY_KEY: identity, NODE_ENV: "production" }))
      .toEqual({ enabled: false, reason: "production" });
    expect(readAssistantConfig(env)).toMatchObject({ enabled: true, realData: false, identityKey: null });
  });

  it("los errores de configuración no exponen el token", () => {
    expect(JSON.stringify(readAssistantConfig({ ...env, AI_SERVICE_URL: "x" }))).not.toContain(TOKEN);
  });

  it("solo ADMIN se traduce a contador_demo", () => {
    expect(assistantRoleFor("ADMIN")).toBe("contador_demo");
    for (const role of ["admin", "CAJERO", "contador_demo", "", "__proto__", "constructor", "toString"]) {
      expect(assistantRoleFor(role)).toBeNull();
    }
  });
});
