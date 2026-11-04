import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as authService from "@/lib/services/auth.service";
import * as usersService from "@/lib/services/users.service";
import * as auditService from "@/lib/services/audit.service";
import * as authPermissions from "@/lib/auth/permissions";
import * as authCurrentSession from "@/lib/auth/current-session";

// Import Route Handlers
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { GET as usersGet, POST as usersPost } from "@/app/api/users/route";
import { PUT as userPut, PATCH as userPatch } from "@/app/api/users/[id]/route";
import { GET as auditLogsGet } from "@/app/api/audit-logs/route";
import { COOKIE_OPTIONS, SESSION_COOKIE } from "@/lib/auth/session";

describe("Security Domain Handlers (users, auth, audit-logs)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/login", () => {
    it("retorna 200 y establece la cookie de sesión con credenciales válidas", async () => {
      vi.spyOn(authService, "loginWithCredentials").mockResolvedValueOnce({
        user: { userId: 1, username: "admin", role: "ADMIN" },
        token: "fake-jwt-token",
        cookieName: SESSION_COOKIE,
        cookieOptions: COOKIE_OPTIONS,
      });

      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "Password123!" }),
      });

      const res = await loginPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ userId: 1, username: "admin", role: "ADMIN" });
      expect(res.headers.get("set-cookie")).toContain("sesion=fake-jwt-token");
    });

    it("retorna 400 si faltan credenciales", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "", password: "" }),
      });

      const res = await loginPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Usuario y contraseña son obligatorios");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("retorna 200 y limpia las cookies de sesión", async () => {
      vi.spyOn(authService, "logoutUser").mockResolvedValueOnce({
        ok: true,
        cookiesToClear: [
          { name: SESSION_COOKIE, options: { ...COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) } },
          { name: "auth-token", options: { ...COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) } },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
      });

      const res = await logoutPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true });
    });
  });

  describe("GET /api/auth/me", () => {
    it("retorna 401 si no hay sesión activa", async () => {
      vi.spyOn(authCurrentSession, "currentSession").mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/auth/me");
      const res = await meGet(req);
      expect(res.status).toBe(401);
    });

    it("retorna el perfil y los permisos cuando hay sesión activa", async () => {
      vi.spyOn(authCurrentSession, "currentSession").mockResolvedValueOnce({
        userId: 1,
        username: "admin",
        role: "ADMIN",
      });
      vi.spyOn(authService, "getCurrentUserProfile").mockResolvedValueOnce({
        userId: 1,
        username: "admin",
        role: "ADMIN",
        superuser: true,
        permissions: ["usuarios.ver", "usuarios.crear"],
      });

      const req = new NextRequest("http://localhost:3000/api/auth/me");
      const res = await meGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.username).toBe("admin");
      expect(data.superuser).toBe(true);
    });
  });

  describe("GET & POST /api/users", () => {
    it("GET /api/users retorna la lista de usuarios con permiso usuarios.ver", async () => {
      vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
        ok: true,
        session: { userId: 1, username: "admin", role: "ADMIN" },
        superuser: true,
      });
      vi.spyOn(usersService, "listUsers").mockResolvedValueOnce([
        {
          user_id: 1,
          username: "admin",
          email: "admin@polleria.pe",
          active: true,
          last_access: null,
          role: { role_id: 1, name: "ADMIN" },
          employee: {
            employee_id: 1,
            dni: "12345678",
            first_name: "Admin",
            middle_name: null,
            paternal_last_name: "Sistema",
            maternal_last_name: null,
          },
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/users");
      const res = await usersGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
    });

    it("POST /api/users crea un usuario y retorna 201", async () => {
      vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
        ok: true,
        session: { userId: 1, username: "admin", role: "ADMIN" },
        superuser: true,
      });
      vi.spyOn(usersService, "createUserWithAudit").mockResolvedValueOnce({
        user_id: 2,
        username: "cajero1",
        email: "cajero1@polleria.pe",
        active: true,
        last_access: null,
        role: { role_id: 2, name: "CAJERO" },
        employee: {
          employee_id: 2,
          dni: "87654321",
          first_name: "Juan",
          middle_name: null,
          paternal_last_name: "Pérez",
          maternal_last_name: null,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: "Juan",
          paternal_last_name: "Pérez",
          dni: "87654321",
          email: "cajero1@polleria.pe",
          username: "cajero1",
          password: "Password123!",
          role_id: 2,
        }),
      });

      const res = await usersPost(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.username).toBe("cajero1");
    });
  });

  describe("PUT & PATCH /api/users/[id]", () => {
    it("PUT /api/users/[id] actualiza los datos y retorna 200", async () => {
      vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
        ok: true,
        session: { userId: 1, username: "admin", role: "ADMIN" },
        superuser: true,
      });
      vi.spyOn(usersService, "updateUserWithAudit").mockResolvedValueOnce({
        user_id: 2,
        username: "cajero_mod",
        email: "cajero1@polleria.pe",
        active: true,
        last_access: null,
        role: { role_id: 2, name: "CAJERO" },
        employee: {
          employee_id: 2,
          dni: "87654321",
          first_name: "Juan",
          middle_name: null,
          paternal_last_name: "Pérez",
          maternal_last_name: null,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/users/2", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: "Juan",
          paternal_last_name: "Pérez",
          dni: "87654321",
          email: "cajero1@polleria.pe",
          username: "cajero_mod",
          role_id: 2,
        }),
      });

      const res = await userPut(req, { params: Promise.resolve({ id: "2" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.username).toBe("cajero_mod");
    });

    it("PATCH /api/users/[id] modifica estado de activación", async () => {
      vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
        ok: true,
        session: { userId: 1, username: "admin", role: "ADMIN" },
        superuser: true,
      });
      vi.spyOn(usersService, "setUserActiveWithAudit").mockResolvedValueOnce({
        user_id: 2,
        username: "cajero1",
        email: "cajero1@polleria.pe",
        active: false,
        last_access: null,
        role: { role_id: 2, name: "CAJERO" },
        employee: {
          employee_id: 2,
          dni: "87654321",
          first_name: "Juan",
          middle_name: null,
          paternal_last_name: "Pérez",
          maternal_last_name: null,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/users/2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      });

      const res = await userPatch(req, { params: Promise.resolve({ id: "2" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.active).toBe(false);
    });
  });

  describe("GET /api/audit-logs", () => {
    it("retorna 403 si el rol no es administrador", async () => {
      vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
        ok: true,
        session: { userId: 2, username: "cajero1", role: "CAJERO" },
        superuser: false,
      });

      const req = new NextRequest("http://localhost:3000/api/audit-logs");
      const res = await auditLogsGet(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Solo un administrador puede ver la auditoría");
    });

    it("retorna 200 y la bitácora si es administrador", async () => {
      vi.spyOn(authPermissions, "authorize").mockResolvedValueOnce({
        ok: true,
        session: { userId: 1, username: "admin", role: "ADMIN" },
        superuser: true,
      });
      vi.spyOn(auditService, "listAuditLogsService").mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 1,
        modules: auditService.AUDIT_MODULES,
        actions: auditService.AUDIT_ACTIONS,
      });

      const req = new NextRequest("http://localhost:3000/api/audit-logs?page=1&perPage=10");
      const res = await auditLogsGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.modules).toBeDefined();
      expect(data.actions).toBeDefined();
    });
  });
});
