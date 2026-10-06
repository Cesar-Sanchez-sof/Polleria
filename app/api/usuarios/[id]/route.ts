import { NextRequest, NextResponse } from "next/server";
import { leerJson, noAutorizado, respuestaError } from "@/lib/auth/respuestas";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { actualizarUsuario, cambiarEstadoUsuario, type DatosUsuario } from "@/lib/services/usuarios.service";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/usuarios/{id}:
 *   put:
 *     tags:
 *       - Usuarios
 *     summary: Actualizar datos del usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioUpdate'
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       400:
 *         description: Petición inválida
 *       401:
 *         description: No autorizado
 *   patch:
 *     tags:
 *       - Usuarios
 *     summary: Cambiar estado del usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               activo:
 *                 type: boolean
 *                 description: Nuevo estado activo del usuario
 *     responses:
 *       200:
 *         description: Estado del usuario actualizado
 *       400:
 *         description: Petición inválida
 *       401:
 *         description: No autorizado
 */

type Contexto = { params: Promise<{ id: string }> };

async function leerId(ctx: Contexto): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Modifica los datos del usuario. */
export async function PUT(request: NextRequest, ctx: Contexto) {
  if (!(await sesionActual())) return noAutorizado();
  const id = await leerId(ctx);
  const cuerpo = await leerJson(request);
  if (!id || !cuerpo) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  try {
    return NextResponse.json(await actualizarUsuario(id, { ...cuerpo, id_rol: Number(cuerpo.id_rol) } as DatosUsuario));
  } catch (e) {
    return respuestaError(e);
  }
}

/** Activa o desactiva: body `{ "estado": boolean }`. */
export async function PATCH(request: NextRequest, ctx: Contexto) {
  const sesion = await sesionActual();
  if (!sesion) return noAutorizado();
  const id = await leerId(ctx);
  const cuerpo = await leerJson(request);
  if (!id || typeof cuerpo?.estado !== "boolean") {
    return NextResponse.json({ error: "Indica el estado (true/false)" }, { status: 400 });
  }
  if (id === sesion.idUsuario && !cuerpo.estado) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }
  try {
    return NextResponse.json(await cambiarEstadoUsuario(id, cuerpo.estado));
  } catch (e) {
    return respuestaError(e);
  }
}