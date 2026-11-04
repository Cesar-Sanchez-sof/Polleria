import { authenticate, UserError } from "@/lib/services/users.service";
import { signSession, SESSION_COOKIE, COOKIE_OPTIONS } from "@/lib/auth/session";
import { logAudit, type AuditActor } from "@/lib/services/audit.service";
import { permissionsForUser } from "@/lib/auth/permissions";
import { ValidationError, UnauthorizedError } from "@/lib/http/route-handler";
import type { SessionPayload } from "@/lib/auth/session";
import { checkInOnLogin, markAttendance, type LoginMarkResult } from "@/lib/services/hr/attendance.service";
import { employeeIdOfUser } from "@/lib/services/employees.service";

export interface LoginParams {
  username?: string | null;
  password?: string | null;
  ipAddress?: string | null;
  /** Navegador del trabajador (para la bitácora de asistencia). */
  userAgent?: string | null;
}

export interface LoginResult {
  user: {
    userId: number;
    username: string;
    role: string;
  };
  token: string;
  cookieName: string;
  cookieOptions: typeof COOKIE_OPTIONS;
  /** Resultado de la marcación automática de asistencia (null si no aplica). */
  attendance: LoginMarkResult | null;
}

export interface LogoutResult {
  ok: boolean;
  /** Salida registrada al cerrar sesión (solo si el trabajador lo pidió). */
  attendance: { marked: boolean; message: string } | null;
  cookiesToClear: Array<{
    name: string;
    options: typeof COOKIE_OPTIONS & { maxAge: number; expires: Date };
  }>;
}

export interface UserProfileResult {
  userId: number;
  username: string;
  role: string;
  superuser: boolean;
  permissions: string[];
}

/**
 * Autentica un usuario mediante credenciales, registra el intento en auditoría
 * y genera el token de sesión JWT.
 */
export async function loginWithCredentials(params: LoginParams): Promise<LoginResult> {
  const username = typeof params.username === "string" ? params.username.trim() : "";
  const password = typeof params.password === "string" ? params.password : "";
  if (!username || !password) {
    throw new ValidationError("Usuario y contraseña son obligatorios");
  }

  const ip = params.ipAddress ?? null;
  try {
    const session = await authenticate(username, password);
    const token = await signSession(session);

    await logAudit({
      actor: { userId: session.userId, username: session.username },
      action: "LOGIN",
      module: "Seguridad",
      entity: "Sesión",
      entityId: session.userId,
      description: `Inicio de sesión de ${session.username}`,
      ipAddress: ip,
    });

    // Asistencia: al entrar con sus credenciales se registra la entrada del turno de hoy.
    const attendance = await checkInOnLogin(session.userId, { username: session.username, ip, userAgent: params.userAgent });
    if (attendance.status === "marked") {
      await logAudit({
        actor: { userId: session.userId, username: session.username },
        action: "CREATE",
        module: "Asistencia",
        entity: "Asistencia",
        entityId: session.userId,
        description: `Entrada registrada al iniciar sesión (${attendance.time})`,
        details: { after: { source: "InicioSesion", time: attendance.time } },
        ipAddress: ip,
      });
    }

    return {
      user: {
        userId: session.userId,
        username: session.username,
        role: session.role,
      },
      token,
      cookieName: SESSION_COOKIE,
      cookieOptions: COOKIE_OPTIONS,
      attendance: attendance.message ? attendance : null,
    };
  } catch (error) {
    if (error instanceof UserError) {
      await logAudit({
        actor: { userId: null, username },
        action: "LOGIN_FAILED",
        module: "Seguridad",
        entity: "Sesión",
        description: `Intento de inicio de sesión fallido para "${username}"`,
        details: { reason: error.message },
        ipAddress: ip,
      });
    }
    throw error;
  }
}

/**
 * Registra el cierre de sesión en auditoría y retorna los nombres y opciones de cookies a limpiar.
 */
export async function logoutUser(
  actor: AuditActor | null,
  ipAddress?: string | null,
  options: { markExit?: boolean; userAgent?: string | null } = {},
): Promise<LogoutResult> {
  // Si el trabajador lo confirma, el cierre de sesión registra también su salida.
  let attendance: LogoutResult["attendance"] = null;
  if (actor?.userId && options.markExit) {
    try {
      const employeeId = await employeeIdOfUser(actor.userId);
      if (employeeId) {
        const r = await markAttendance(employeeId, "check_out", {
          actorUserId: actor.userId,
          actorUsername: actor.username,
          source: "CierreSesion",
          ip: ipAddress ?? null,
          userAgent: options.userAgent ?? null,
        });
        attendance = { marked: true, message: `Salida registrada a las ${r.time}` };
        await logAudit({
          actor,
          action: "CREATE",
          module: "Asistencia",
          entity: "Asistencia",
          entityId: r.attendance_id,
          description: `Salida registrada al cerrar sesión (${r.date} ${r.time})`,
          details: { after: { source: "CierreSesion", time: r.time } },
          ipAddress: ipAddress ?? null,
        });
      }
    } catch (e) {
      attendance = { marked: false, message: e instanceof Error ? e.message : "No se pudo registrar la salida" };
    }
  }
  if (actor) {
    await logAudit({
      actor,
      action: "LOGOUT",
      module: "Seguridad",
      entity: "Sesión",
      entityId: actor.userId,
      description: `Cierre de sesión de ${actor.username}`,
      ipAddress: ipAddress ?? null,
    });
  }

  const expiredOptions = {
    ...COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  };

  return {
    ok: true,
    attendance,
    cookiesToClear: [
      { name: SESSION_COOKIE, options: expiredOptions },
      { name: "auth-token", options: expiredOptions },
    ],
  };
}

/**
 * Obtiene el perfil vigente de la sesión activa con sus permisos y estado de superusuario.
 */
export async function getCurrentUserProfile(session: SessionPayload | null | undefined): Promise<UserProfileResult> {
  if (!session) {
    throw new UnauthorizedError("No autenticado");
  }
  const access = await permissionsForUser(session.userId);
  return {
    userId: session.userId,
    username: session.username,
    role: session.role,
    superuser: access.superuser,
    permissions: access.codes,
  };
}
