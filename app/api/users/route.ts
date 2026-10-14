import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { verifyAssignableRole } from "@/lib/services/roles.service";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import {
  listUsers,
  createUser,
  type UserData,
} from "@/lib/services/users.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Usuarios
 *     summary: Listar todos los usuarios del sistema
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso usuarios.ver
 *   post:
 *     tags:
 *       - Usuarios
 *     summary: Crear un nuevo usuario y empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso usuarios.crear
 */
export async function GET() {
  try {
    const auth = await authorize("usuarios.ver");
    if (!auth.ok) return auth.response;

    const users = await listUsers();
    return NextResponse.json(users);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("usuarios.crear");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = (await readJson(request)) as unknown as UserData;
    if (!body) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }

    // El rol debe existir, estar activo y, si es de sistema, solo lo asigna un administrador.
    await verifyAssignableRole(body.role_id, auth.superuser);

    const newUser = await createUser(body);
    await logAudit({
      actor: { userId: session.userId, username: session.username },
      action: "CREATE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: newUser.user_id,
      description: `Creó el usuario ${newUser.username}`,
      details: { after: { username: newUser.username, email: newUser.email, role: newUser.role.name } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}