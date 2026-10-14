import { NextRequest, NextResponse } from "next/server";
import { leerJson, respuestaError } from "@/lib/auth/respuestas";
import { autorizar } from "@/lib/auth/permisos";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";
import { actualizarRol, eliminarRol, obtenerRol, type DatosRol } from "@/lib/services/roles.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/roles/{id}:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Obtener un rol con sus permisos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol
 *       404:
 *         description: Rol no encontrado
 *   put:
 *     tags:
 *       - Roles
 *     summary: Modificar un rol y sus permisos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol actualizado
 *       409:
 *         description: Nombre duplicado o rol con usuarios asignados
 *   delete:
 *     tags:
 *       - Roles
 *     summary: Eliminar un rol (bloqueado si es de sistema o tiene usuarios)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol eliminado
 *       409:
 *         description: El rol tiene usuarios asignados
 */
type Contexto = { params: Promise<{ id: string }> };

async function leerId(ctx: Contexto): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const PETICION_INVALIDA = () => NextResponse.json({ error: "Petición inválida" }, { status: 400 });

export async function GET(_request: NextRequest, ctx: Contexto) {
  try {
    const auth = await autorizar("roles.ver");
    if (!auth.ok) return auth.respuesta;
    const id = await leerId(ctx);
    if (!id) return PETICION_INVALIDA();
    return NextResponse.json(await obtenerRol(id));
  } catch (error) {
    return respuestaError(error);
  }
}

export async function PUT(request: NextRequest, ctx: Contexto) {
  try {
    const auth = await autorizar("roles.editar");
    if (!auth.ok) return auth.respuesta;
    const id = await leerId(ctx);
    const cuerpo = await leerJson(request);
    if (!id || !cuerpo) return PETICION_INVALIDA();

    const antes = await obtenerRol(id);
    const rol = await actualizarRol(id, cuerpo as unknown as DatosRol);
    await registrarAuditoria({
      actor: { userId: auth.sesion.idUsuario, username: auth.sesion.username },
      action: "UPDATE",
      module: "Seguridad",
      entity: "Rol",
      entityId: id,
      description: `Modificó el rol ${rol.nombre}`,
      details: {
        antes: { nombre: antes.nombre, activo: antes.activo, permisos: antes.permisos },
        despues: { nombre: rol.nombre, activo: rol.activo, permisos: rol.permisos },
      },
      ipAddress: ipDeSolicitud(request),
    });
    return NextResponse.json(rol);
  } catch (error) {
    return respuestaError(error);
  }
}

export async function DELETE(request: NextRequest, ctx: Contexto) {
  try {
    const auth = await autorizar("roles.eliminar");
    if (!auth.ok) return auth.respuesta;
    const id = await leerId(ctx);
    if (!id) return PETICION_INVALIDA();

    const rol = await eliminarRol(id);
    await registrarAuditoria({
      actor: { userId: auth.sesion.idUsuario, username: auth.sesion.username },
      action: "DELETE",
      module: "Seguridad",
      entity: "Rol",
      entityId: id,
      description: `Eliminó el rol ${rol.nombre}`,
      details: { antes: { nombre: rol.nombre, permisos: rol.permisos } },
      ipAddress: ipDeSolicitud(request),
    });
    return NextResponse.json(rol);
  } catch (error) {
    return respuestaError(error);
  }
}