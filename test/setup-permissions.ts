import { vi } from "vitest";

/**
 * En los tests unitarios no hay cookie de sesión ni BD: las APIs y server actions
 * que exigen permisos reciben un administrador simulado. Los tests de la propia
 * lógica de permisos (lib/auth/permissions.test.ts) usan la implementación real
 * con vi.importActual.
 */
vi.mock("@/lib/auth/permissions", () => ({
  authorize: vi.fn(async () => ({
    ok: true,
    session: { userId: 1, username: "test", role: "ADMIN" },
    superuser: true,
  })),
  requirePermission: vi.fn(async () => ({ userId: 1, username: "test", role: "ADMIN" })),
  permissionsForUser: vi.fn(async () => ({ superuser: true, codes: [] })),
  hasPermission: vi.fn(() => true),
}));