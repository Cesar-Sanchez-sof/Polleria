import { vi } from "vitest";

/**
 * En los tests unitarios no hay cookie de sesión ni BD: las APIs y server actions
 * que exigen permisos reciben un administrador simulado. Los tests de la propia
 * lógica de permisos (lib/auth/permisos.test.ts) usan la implementación real
 * con vi.importActual.
 */
vi.mock("@/lib/auth/permisos", () => ({
  autorizar: vi.fn(async () => ({
    ok: true,
    sesion: { idUsuario: 1, username: "test", rol: "ADMIN" },
    superusuario: true,
  })),
  exigirPermiso: vi.fn(async () => ({ idUsuario: 1, username: "test", rol: "ADMIN" })),
  permisosDeUsuario: vi.fn(async () => ({ superusuario: true, codigos: [] })),
  tienePermiso: vi.fn(() => true),
}));