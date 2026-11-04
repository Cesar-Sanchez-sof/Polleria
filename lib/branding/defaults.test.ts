import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING, MAX_UPDATES, assetUrl, detectImageMime, isAssetSlot, resolveBranding } from "./defaults";

describe("resolveBranding", () => {
  it("sin datos devuelve los valores por defecto", () => {
    expect(resolveBranding(null)).toEqual(DEFAULT_BRANDING);
    expect(resolveBranding("texto")).toEqual(DEFAULT_BRANDING);
    expect(resolveBranding([])).toEqual(DEFAULT_BRANDING);
  });

  it("respeta lo editado y completa lo que falta", () => {
    const result = resolveBranding({ brandName: "  El Buen   Sabor ", login: { title: "Bienvenido" } });
    expect(result.brandName).toBe("El Buen Sabor");
    expect(result.login.title).toBe("Bienvenido");
    expect(result.login.subtitle).toBe(DEFAULT_BRANDING.login.subtitle);
    expect(result.home).toEqual(DEFAULT_BRANDING.home);
  });

  it("un texto vacío o que no es texto vuelve al valor por defecto y los largos se recortan", () => {
    const result = resolveBranding({ tagline: "   ", slogan: 42, fullName: "x".repeat(500) });
    expect(result.tagline).toBe(DEFAULT_BRANDING.tagline);
    expect(result.slogan).toBe(DEFAULT_BRANDING.slogan);
    expect(result.fullName).toHaveLength(80);
  });

  it("los enlaces solo pueden ser rutas internas", () => {
    for (const bad of ["https://malo.example", "//malo.example", "javascript:alert(1)", "sales", "/a b", "/a\\b", ""]) {
      expect(resolveBranding({ home: { primaryHref: bad } }).home.primaryHref).toBe(DEFAULT_BRANDING.home.primaryHref);
    }
    expect(resolveBranding({ home: { primaryHref: "/purchases/list" } }).home.primaryHref).toBe("/purchases/list");
  });

  it("sin lista de novedades usa las de por defecto; con lista (aunque vacía) respeta la del usuario", () => {
    expect(resolveBranding({ home: {} }).home.updates).toEqual(DEFAULT_BRANDING.home.updates);
    expect(resolveBranding({ home: { updates: "no es una lista" } }).home.updates).toEqual(DEFAULT_BRANDING.home.updates);
    expect(resolveBranding({ home: { updates: [] } }).home.updates).toEqual([]);
  });

  it("las novedades se sanean: sin título se descartan, fechas inválidas pasan a hoy y hay un tope", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = resolveBranding({
      home: {
        updates: [
          { date: "2026-10-05", title: "  Nueva carta ", description: "Platos   nuevos" },
          { date: "2026-13-45", title: "Fecha rara" },
          { date: "ayer", title: "Otra", description: 5 },
          { date: "2026-10-05", title: "   ", description: "sin título" },
          null,
          "texto",
        ],
      },
    });
    expect(result.home.updates).toEqual([
      { date: "2026-10-05", title: "Nueva carta", description: "Platos nuevos" },
      { date: today, title: "Fecha rara", description: "" },
      { date: today, title: "Otra", description: "" },
    ]);
    const many = Array.from({ length: 20 }, (_, i) => ({ date: "2026-10-05", title: `n${i}` }));
    expect(resolveBranding({ home: { updates: many } }).home.updates).toHaveLength(MAX_UPDATES);
  });

  it("es idempotente", () => {
    const once = resolveBranding({ brandName: "X", home: { title: "Y" } });
    expect(resolveBranding(once)).toEqual(once);
  });
});

describe("imágenes", () => {
  it("reconoce las ranuras válidas", () => {
    expect(isAssetSlot("logo")).toBe(true);
    expect(isAssetSlot("home-hero")).toBe(true);
    expect(isAssetSlot("../etc/passwd")).toBe(false);
    expect(isAssetSlot(undefined)).toBe(false);
  });

  it("arma la dirección con versión", () => {
    expect(assetUrl("logo")).toBe("/api/branding/assets/logo");
    expect(assetUrl("home-hero", 123)).toBe("/api/branding/assets/home-hero?v=123");
  });

  it("detecta el tipo por los primeros bytes", () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(detectImageMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageMime(new Uint8Array([]))).toBeNull();
  });
});
