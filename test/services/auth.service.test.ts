import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loginWithCredentials,
  logoutUser,
  getCurrentUserProfile,
} from "@/lib/services/security/auth.service";
import * as usersService from "@/lib/services/security/users.service";
import * as auditService from "@/lib/services/security/audit.service";
import * as permissionsModule from "@/lib/auth/permissions";
import { ValidationError, UnauthorizedError } from "@/lib/http/route-handler";

describe("auth.service - Servicio de Autenticación de Dominio", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("loginWithCredentials", () => {
    it("lanza ValidationError si falta el usuario o la contraseña", async () => {
      await expect(
        loginWithCredentials({ username: "", password: "123" })
      ).rejects.toThrow(ValidationError);

      await expect(
        loginWithCredentials({ username: "admin", password: "" })
      ).rejects.toThrow(ValidationError);
    });

    it("autentica con éxito, firma sesión y registra auditoría LOGIN", async () => {
      vi.spyOn(usersService, "authenticate").mockResolvedValueOnce({
        userId: 1,
        username: "admin",
        role: "ADMIN",
      });
      const logAuditSpy = vi.spyOn(auditService, "logAudit").mockResolvedValueOnce(undefined);

      const result = await loginWithCredentials({
        username: "admin",
        password: "Password123!",
        ipAddress: "127.0.0.1",
      });

      expect(result.user).toEqual({
        userId: 1,
        username: "admin",
        role: "ADMIN",
      });
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.cookieName).toBe("sesion");
      expect(logAuditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LOGIN",
          module: "Seguridad",
          entity: "Sesión",
          entityId: 1,
          ipAddress: "127.0.0.1",
        })
      );
    });

    it("registra LOGIN_FAILED cuando las credenciales son incorrectas", async () => {
      vi.spyOn(usersService, "authenticate").mockRejectedValueOnce(
        new usersService.UserError("Usuario o contraseña incorrectos", 401)
      );
      const logAuditSpy = vi.spyOn(auditService, "logAudit").mockResolvedValueOnce(undefined);

      await expect(
        loginWithCredentials({
          username: "admin",
          password: "WrongPassword",
          ipAddress: "192.168.1.50",
        })
      ).rejects.toThrow("Usuario o contraseña incorrectos");

      expect(logAuditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LOGIN_FAILED",
          module: "Seguridad",
          entity: "Sesión",
          ipAddress: "192.168.1.50",
          details: { reason: "Usuario o contraseña incorrectos" },
        })
      );
    });
  });

  describe("logoutUser", () => {
    it("registra LOGOUT y retorna configuración para expirar cookies", async () => {
      const logAuditSpy = vi.spyOn(auditService, "logAudit").mockResolvedValueOnce(undefined);

      const result = await logoutUser(
        { userId: 10, username: "cajero1" },
        "10.0.0.1"
      );

      expect(result.ok).toBe(true);
      expect(result.cookiesToClear).toHaveLength(2);
      expect(result.cookiesToClear.map((c) => c.name)).toEqual(["sesion", "auth-token"]);
      expect(result.cookiesToClear[0].options.maxAge).toBe(0);
      expect(logAuditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LOGOUT",
          module: "Seguridad",
          entityId: 10,
        })
      );
    });
  });

  describe("getCurrentUserProfile", () => {
    it("lanza UnauthorizedError si no hay sesión activa", async () => {
      await expect(getCurrentUserProfile(null)).rejects.toThrow(UnauthorizedError);
      await expect(getCurrentUserProfile(undefined)).rejects.toThrow(UnauthorizedError);
    });

    it("retorna el perfil y los permisos vigentes del usuario", async () => {
      vi.spyOn(permissionsModule, "permissionsForUser").mockResolvedValueOnce({
        superuser: true,
        codes: ["usuarios.ver", "usuarios.crear", "ventas.ver"],
      });

      const profile = await getCurrentUserProfile({
        userId: 1,
        username: "admin",
        role: "ADMIN",
      });

      expect(profile).toEqual({
        userId: 1,
        username: "admin",
        role: "ADMIN",
        superuser: true,
        permissions: ["usuarios.ver", "usuarios.crear", "ventas.ver"],
      });
    });
  });
});
