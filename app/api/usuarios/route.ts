import { NextRequest, NextResponse } from "next/server";
import { leerJson, noAutorizado, respuestaError } from "@/lib/auth/respuestas";
import { sesionActual } from "@/lib/auth/sesion-actual";
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
 */
export async function GET() {
  try {
    const sesion = await sesionActual().catch(() => null);
    if (!sesion) return noAutorizado();

    const usuarios = await listarUsuarios();
    return NextResponse.json(usuarios);
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const sesion = await sesionActual().catch(() => null);
    if (!sesion) return noAutorizado();

    const body = (await leerJson(request)) as unknown as DatosUsuario;
    if (!body) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }

    const nuevoUsuario = await crearUsuario(body);
    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    return respuestaError(error);
  }
}
