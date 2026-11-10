import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardCatalogService } from "@/lib/services/settings/dashboard-catalog.service";
import { GET } from "@/app/api/dashboards/catalog/route";
import { NextRequest } from "next/server";

// Mock de autenticación y permisos
const permissionsForUserMock = vi.fn();
vi.mock("@/lib/auth/permissions", () => ({
  authorize: vi.fn().mockResolvedValue({ ok: true, session: { userId: 1, role: "admin" } }),
  permissionsForUser: (...args: unknown[]) => permissionsForUserMock(...args),
  hasPermission: (access: { superuser: boolean; codes: string[] } | undefined, code: string) =>
    Boolean(access?.superuser || access?.codes?.includes(code)),
}));

describe("Catálogo Semántico de Dashboards (GET /api/dashboards/catalog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("un usuario sin el permiso 'asientos.ver' NO ve el dataset 'contabilidad'", async () => {
    permissionsForUserMock.mockResolvedValueOnce({
      superuser: false,
      codes: ["tableros.ver", "ventas.ver", "pedidos.ver"], // NO tiene asientos.ver ni compras.ver
    });

    const catalog = await getDashboardCatalogService({
      userId: 5,
      superuser: false,
    });

    const datasetIds = catalog.map((d) => d.id);
    expect(datasetIds).toContain("ventas");
    expect(datasetIds).toContain("pedidos");
    expect(datasetIds).not.toContain("contabilidad");
    expect(datasetIds).not.toContain("compras");
  });

  it("excluye campos marcados como hidden: true (ej. campo 'id' técnico)", async () => {
    const catalog = await getDashboardCatalogService({ superuser: true });
    const ventas = catalog.find((d) => d.id === "ventas");
    expect(ventas).toBeDefined();

    const fieldIds = ventas!.fields.map((f) => f.id);
    expect(fieldIds).not.toContain("id"); // Campo técnico oculto
    expect(fieldIds).toContain("fecha");
    expect(fieldIds).toContain("total");
    expect(fieldIds).toContain("cliente");
  });

  it("devuelve metadatos limpios y serializables sin funciones ni rutas internas de Prisma", async () => {
    const catalog = await getDashboardCatalogService({ superuser: true });
    const primerDataset = catalog[0];

    expect(primerDataset.id).toBeDefined();
    expect(primerDataset.label).toBeDefined();
    expect(primerDataset.isTransactional).toBeDefined();
    expect(primerDataset.fields.length).toBeGreaterThan(0);

    const primerCampo = primerDataset.fields[0];
    // No debe contener funciones ni propiedades privadas de BD
    expect((primerCampo as unknown as Record<string, unknown>).customExtractor).toBeUndefined();
    expect((primerCampo as unknown as Record<string, unknown>).calculate).toBeUndefined();
    expect((primerCampo as unknown as Record<string, unknown>).calculateGroup).toBeUndefined();
    expect((primerCampo as unknown as Record<string, unknown>).prismaField).toBeUndefined();
    expect((primerCampo as unknown as Record<string, unknown>).prismaPath).toBeUndefined();
  });

  it("el endpoint GET /api/dashboards/catalog responde 200 con éxito y la estructura serializada", async () => {
    permissionsForUserMock.mockResolvedValueOnce({
      superuser: true,
      codes: ["*"],
    });

    const req = new NextRequest("http://localhost:3000/api/dashboards/catalog", {
      method: "GET",
    });

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(10);
  });

  it("asigna el defaultDateField correcto a cada dataset (ventas y compras tienen 'fecha' = issuedAt, contabilidad 'fecha')", async () => {
    const catalog = await getDashboardCatalogService({ superuser: true });
    const mapDefaults = Object.fromEntries(catalog.map((d) => [d.id, d.defaultDateField]));

    // Verificación exacta de cada dataset
    expect(mapDefaults["ventas"]).toBe("fecha");
    expect(mapDefaults["compras"]).toBe("fecha");
    expect(mapDefaults["inventario"]).toBeUndefined(); // Maestro sin fechas
    expect(mapDefaults["contabilidad"]).toBe("fecha");
    expect(mapDefaults["pedidos"]).toBe("fechaHora");
    expect(mapDefaults["platos_vendidos"]).toBe("fechaHora");
    expect(mapDefaults["pagos_venta"]).toBe("fecha");
    expect(mapDefaults["compras_detalle"]).toBe("fecha");
    expect(mapDefaults["movimientos_inventario"]).toBe("fecha");
    expect(mapDefaults["gastos_menores"]).toBe("fecha");
  });

  it("verifica labels de ventas y nuevo campo fechaRegistro en contabilidad", async () => {
    const catalog = await getDashboardCatalogService({ superuser: true });
    const ventas = catalog.find((d) => d.id === "ventas")!;
    const fechaEmision = ventas.fields.find((f) => f.id === "fecha")!;
    const fechaCreacion = ventas.fields.find((f) => f.id === "fechaCreacion")!;

    expect(fechaEmision.label).toBe("Fecha de emisión (comprobante)");
    expect(fechaCreacion.label).toBe("Fecha y hora de la venta");

    const contabilidad = catalog.find((d) => d.id === "contabilidad")!;
    const fechaRegistro = contabilidad.fields.find((f) => f.id === "fechaRegistro")!;
    expect(fechaRegistro).toBeDefined();
    expect(fechaRegistro.label).toBe("Fecha y hora de registro");
    expect(fechaRegistro.hasTime).toBe(true);
    expect(fechaRegistro.supportedGranularities).toContain("hourOfDay");
  });

  it("expone hourOfDay en supportedGranularities exclusivamente para campos con hasTime=true", async () => {
    const catalog = await getDashboardCatalogService({ superuser: true });
    const ventas = catalog.find((d) => d.id === "ventas")!;
    const fechaCreacion = ventas.fields.find((f) => f.id === "fechaCreacion")!;
    const fechaEmision = ventas.fields.find((f) => f.id === "fecha")!;

    expect(fechaCreacion.hasTime).toBe(true);
    expect(fechaCreacion.supportedGranularities).toContain("hourOfDay");

    expect(fechaEmision.hasTime).toBe(false);
    expect(fechaEmision.supportedGranularities).not.toContain("hourOfDay");
  });
});
