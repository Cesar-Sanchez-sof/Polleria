import { NextRequest, NextResponse } from "next/server";
import { leerJson, noAutorizado, respuestaError } from "@/lib/auth/respuestas";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { autorizar } from "@/lib/auth/permisos";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";
import { listarRoles } from "@/lib/services/usuarios.service";
import { crearRol, listarRolesGestion, type DatosRol } from "@/lib/services/roles.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/roles:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Listar roles activos (selector) o, con ?detalle=1, todos con sus permisos
 *     responses:
 *       200:
 *         description: Lista de roles
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso roles.ver (solo con detalle=1)
 *   post:
 *     tags:
 *       - Roles
 *     summary: Crear un rol con sus permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               permisos:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Rol creado
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Sin permiso roles.crear
 *       409:
 *         description: Ya existe un rol con ese nombre
 */
export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("detalle") === "1") {
      const auth = await autorizar("roles.ver");
      if (!auth.ok) return auth.respuesta;
      return NextResponse.json(await listarRolesGestion());
    }

    const sesion = await sesionActual().catch(() => null);
    if (!sesion) return noAutorizado();
    return NextResponse.json(await listarRoles());
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await autorizar("roles.crear");
    if (!auth.ok) return auth.respuesta;

    const cuerpo = await leerJson(request);
    if (!cuerpo) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const rol = await crearRol(cuerpo as unknown as DatosRol);
    await registrarAuditoria({
      actor: { userId: auth.sesion.idUsuario, username: auth.sesion.username },
      action: "CREATE",
      module: "Seguridad",
      entity: "Rol",
      entityId: rol.id_rol,
      description: `Creó el rol ${rol.nombre}`,
      details: { despues: { nombre: rol.nombre, activo: rol.activo, permisos: rol.permisos } },
      ipAddress: ipDeSolicitud(request),
    });
    return NextResponse.json(rol, { status: 201 });
  } catch (error) {
    return respuestaError(error);
  }
}