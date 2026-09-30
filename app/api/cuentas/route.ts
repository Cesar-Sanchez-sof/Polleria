import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  aCuentaApi,
  codigoDuplicado,
  respuestaCodigoDuplicado,
  respuestaValidacion,
  SELECT_CUENTA,
  validarCuenta,
} from "@/lib/plan-contable";

export const dynamic = "force-dynamic";

/**
 * Plan contable completo (raíces y subcuentas), ordenado por código.
 *
 * El listado no se pagina: el front arma el árbol con el conjunto completo y
 * filtra en cliente, de modo que una subcuenta nunca se separa de su padre.
 */
export async function GET() {
  try {
    const cuentas = await prisma.cuenta_contable.findMany({
      orderBy: { codigo: "asc" },
      select: SELECT_CUENTA,
    });

    return Response.json({ data: cuentas.map(aCuentaApi) });
  } catch (error) {
    console.error("[api/cuentas] error al obtener el plan contable:", error);
    return Response.json({ error: "No se pudo obtener el plan contable." }, { status: 500 });
  }
}

/**
 * Registra una cuenta contable nueva.
 *
 * Body: `{ codigo, nombre, tipo, idPadre?, activo? }`. El código es único en
 * toda la tabla (índice + comprobación previa) y una subcuenta hereda el tipo
 * de su cuenta padre, de modo que el tipo de una jerarquía siempre es el mismo.
 */
export async function POST(request: NextRequest) {
  try {
    const cuerpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      return Response.json(
        { error: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const { errores, valores } = validarCuenta(cuerpo, "alta");
    if (errores.length > 0) return respuestaValidacion(errores);

    const codigo = valores.codigo as string;
    const tipo = valores.tipo as string;
    const idPadre = valores.idPadre ?? null;

    // El código no puede repetirse en el plan contable.
    const repetida = await prisma.cuenta_contable.findUnique({
      where: { codigo },
      select: { id_cuenta_contable: true },
    });
    if (repetida) return respuestaCodigoDuplicado(codigo);

    // Jerarquía: la cuenta padre debe existir, estar activa y compartir el tipo.
    if (idPadre !== null) {
      const padre = await prisma.cuenta_contable.findUnique({
        where: { id_cuenta_contable: idPadre },
        select: { id_cuenta_contable: true, tipo: true, activo: true },
      });

      if (!padre) errores.push("La cuenta padre indicada no existe.");
      else {
        if (!padre.activo) {
          errores.push("La cuenta padre está inactiva: actívala antes de crear subcuentas.");
        }
        if (padre.tipo !== tipo) {
          errores.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${padre.tipo}).`);
        }
      }
      if (errores.length > 0) return respuestaValidacion(errores);
    }

    try {
      const cuenta = await prisma.cuenta_contable.create({
        data: {
          codigo,
          nombre: valores.nombre as string,
          tipo,
          id_cuenta_padre: idPadre,
          activo: valores.activo ?? true,
        },
        select: SELECT_CUENTA,
      });

      return Response.json(aCuentaApi(cuenta), { status: 201 });
    } catch (error) {
      // Otra petición creó el mismo código entre la comprobación y el alta.
      if (codigoDuplicado(error)) return respuestaCodigoDuplicado(codigo);
      throw error;
    }
  } catch (error) {
    console.error("[api/cuentas] error al registrar la cuenta:", error);
    return Response.json(
      { error: "No se pudo registrar la cuenta contable." },
      { status: 500 }
    );
  }
}
