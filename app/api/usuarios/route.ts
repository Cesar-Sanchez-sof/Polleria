import { NextRequest, NextResponse } from "next/server";
import { leerJson, respuestaError } from "@/lib/auth/respuestas";
import { autorizar } from "@/lib/auth/permisos";
import { verificarRolAsignable } from "@/lib/services/roles.service";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";
import {
  listarUsuarios,
  crearUsuario,
  type DatosUsuario,
} from "@/lib/services/usuarios.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/usuarios:
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
    const auth = await autorizar("usuarios.ver");
    if (!auth.ok) return auth.respuesta;

    const usuarios = await listarUsuarios();
    return NextResponse.json(usuarios);
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await autorizar("usuarios.crear");
    if (!auth.ok) return auth.respuesta;
    const sesion = auth.sesion;

    const body = (await leerJson(request)) as unknown as DatosUsuario;
    if (!body) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }

    // El rol debe existir, estar activo y, si es de sistema, solo lo asigna un administrador.
    await verificarRolAsignable(body.id_rol, auth.superusuario);

    const nuevoUsuario = await crearUsuario(body);
    await registrarAuditoria({
      actor: { userId: sesion.idUsuario, username: sesion.username },
      action: "CREATE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: nuevoUsuario.id_usuario,
      description: `Creó el usuario ${nuevoUsuario.username}`,
      details: { despues: { username: nuevoUsuario.username, correo: nuevoUsuario.correo, rol: nuevoUsuario.rol.nombre } },
      ipAddress: ipDeSolicitud(request),
    });
    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    return respuestaError(error);
  }
}