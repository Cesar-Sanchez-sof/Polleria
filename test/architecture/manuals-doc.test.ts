import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VALID_CODES } from "@/lib/auth/permissions-catalog";
import { linkPermission, requiredPermissions, SECTIONS } from "@/lib/auth/route-permissions";
import {
  ROLE_PREVIEW_PRESETS,
  USER_MANUAL_SECTIONS,
  filterManualSections,
} from "@/app/docs/user-manual/manual-data";
import {
  DEPLOYMENT_ENV_VARS,
  DEPLOYMENT_SECTIONS,
  DEPLOYMENT_TROUBLESHOOTING,
} from "@/app/docs/deployment/deployment-data";

const ROOT = process.cwd();

describe("Manual de Usuario y Manual de Despliegue (/docs)", () => {
  it("registra permisos y rutas RBAC válidas para ambos manuales", () => {
    expect(linkPermission("/docs/user-manual")).toBe("manual.ver");
    expect(linkPermission("/docs/deployment")).toBe("despliegue.ver");

    expect(requiredPermissions("/docs/user-manual")).toEqual(["manual.ver"]);
    expect(requiredPermissions("/docs/deployment")).toEqual(["despliegue.ver"]);
    expect(requiredPermissions("/docs/architecture")).toEqual(["diagrama.ver"]);

    expect(SECTIONS.documentation).toContain("manual.ver");
    expect(SECTIONS.documentation).toContain("despliegue.ver");
    expect(VALID_CODES.has("manual.ver")).toBe(true);
    expect(VALID_CODES.has("despliegue.ver")).toBe(true);
  });

  it("incluye ambos enlaces dentro de la sección DOCUMENTACIÓN del Sidebar", () => {
    const sidebarSource = readFileSync(join(ROOT, "components/personalized/Sidebar.tsx"), "utf8");
    expect(sidebarSource).toContain('href: "/docs/user-manual"');
    expect(sidebarSource).toContain('href: "/docs/deployment"');
  });

  it("todos los códigos de permiso usados en el Manual de Usuario existen en VALID_CODES", () => {
    for (const section of USER_MANUAL_SECTIONS) {
      for (const perm of section.requiredPermissions) {
        expect(VALID_CODES.has(perm), `Permiso desconocido en sección ${section.id}: ${perm}`).toBe(true);
      }
      for (const step of section.steps) {
        if (step.actionPermission) {
          expect(VALID_CODES.has(step.actionPermission), `Permiso desconocido en paso ${step.title}: ${step.actionPermission}`).toBe(true);
        }
      }
    }

    for (const preset of ROLE_PREVIEW_PRESETS) {
      if (!preset.permissions) continue;
      for (const perm of preset.permissions) {
        expect(VALID_CODES.has(perm), `Permiso desconocido en preset ${preset.id}: ${perm}`).toBe(true);
      }
    }
  });

  it("incluye al menos una sección general accesible sin permisos de módulo y filtra según permisos del rol", () => {
    const generalSections = USER_MANUAL_SECTIONS.filter((s) => s.requiredPermissions.length === 0);
    expect(generalSections.length).toBeGreaterThanOrEqual(1);

    // Usuario Mesero: ve sección general + salón/cocina, pero NO contabilidad ni seguridad
    const meseroPerms = new Set(["pedidos.ver", "bebidas.ver", "listos.ver", "platos.ver", "manual.ver"]);
    const meseroVisible = filterManualSections(USER_MANUAL_SECTIONS, {
      superuser: false,
      canAny: (codes) => codes.some((c) => meseroPerms.has(c)),
    }).map((s) => s.id);

    expect(meseroVisible).toContain("acceso-y-autoservicio");
    expect(meseroVisible).toContain("salon-mesas-pedidos");
    expect(meseroVisible).not.toContain("contabilidad-sunat");
    expect(meseroVisible).not.toContain("seguridad-y-configuracion");

    // Superusuario: ve todas las secciones
    const adminVisible = filterManualSections(USER_MANUAL_SECTIONS, {
      superuser: true,
      canAny: () => false,
    });
    expect(adminVisible.length).toBe(USER_MANUAL_SECTIONS.length);
  });

  it("otorga manual.ver a todos los roles base en seed-roles.ts", () => {
    const seedSource = readFileSync(join(ROOT, "prisma/seed-roles.ts"), "utf8");
    const matches = seedSource.match(/\.\.\.p\("manual", "ver"\)/g) ?? [];
    // CAJERO, MESERO, COCINERO, CONTADOR, RRHH
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it("el Manual de Despliegue contiene secciones, variables de entorno obligatorias y troubleshooting", () => {
    expect(DEPLOYMENT_SECTIONS.length).toBeGreaterThanOrEqual(4);
    for (const sec of DEPLOYMENT_SECTIONS) {
      expect(sec.title.length).toBeGreaterThan(0);
      expect(sec.checklist.length).toBeGreaterThan(0);
    }

    const requiredEnvNames = DEPLOYMENT_ENV_VARS.filter((v) => v.required).map((v) => v.name);
    expect(requiredEnvNames).toEqual(
      expect.arrayContaining(["DATABASE_URL", "SESSION_SECRET", "NEXT_PUBLIC_APP_URL", "TZ"]),
    );
    expect(DEPLOYMENT_TROUBLESHOOTING.length).toBeGreaterThanOrEqual(3);
  });

  it("restringe Imprimir/PDF solo al Administrador (superuser) y configura reglas A4 sin romper tickets 80mm", () => {
    const toolbarSource = readFileSync(join(ROOT, "components/docs/ManualPrintToolbar.tsx"), "utf8");
    const userManualSource = readFileSync(join(ROOT, "app/docs/user-manual/page.tsx"), "utf8");
    const deploymentSource = readFileSync(join(ROOT, "app/docs/deployment/page.tsx"), "utf8");
    const globalsCss = readFileSync(join(ROOT, "app/globals.css"), "utf8");

    expect(toolbarSource).toContain("if (loading || !superuser) return null;");
    expect(toolbarSource).toContain("/api/branding/assets/logo");
    expect(toolbarSource).toContain("DEFAULT_BRANDING");
    expect(userManualSource).toContain("ManualPrintButton");
    expect(userManualSource).toContain("ManualPrintFooter");
    expect(deploymentSource).toContain("ManualPrintButton");
    expect(deploymentSource).toContain("ManualPrintFooter");
    expect(userManualSource).not.toContain("window.print()");
    expect(deploymentSource).not.toContain("window.print()");

    expect(globalsCss).toContain(".ticket-termico-print");
    expect(globalsCss).toContain(".manual-doc-print");
  });
});
