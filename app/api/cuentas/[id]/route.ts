import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  aCuentaApi,
  codigoDuplicado,
  descendientesDe,
  respuestaCodigoDuplicado,
  respuestaValidacion,
  SELECT_CUENTA,
  validarCuenta,
  type NodoJerarquia,
} from "@/lib/plan-contable";

export const dynamic = "force-dynamic";

/** Padre mínimo que se necesita para validar jerarquía y estado. */
const SELECT_PADRE = {
  id_cuenta_contable: true,
  tipo: true,
  activo: true,
} as const;

/** Datos públicos de la cuenta que se está modificando. */
const SELECT_NODO = {
  id_cuenta_contable: true,
  id_cuenta_padre: true,
} as const;

/** Cuenta contable individual (detalle o base de la edición). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);

    if (Number.isNaN(id)) {
      return Response.json({ error: "Identificador de cuenta inválido." }, { status: 400 });
    }

    const cuenta = await prisma.cuenta_contable.findUnique({
      where: { id_cuenta_contable: id },
      select: SELECT_CUENTA,
    });

    if (!cuenta) {
      return Response.json({ error: "Cuenta contable no encontrada." }, { status: 404 });
    }

    return Response.json(aCuentaApi(cuenta));
  } catch (error) {
    console.error("[api/cuentas/[id]] error al obtener la cuenta:", error);
    return Response.json(
      { error: "No se pudo obtener la cuenta contable." },
      { status: 500 }
    );
  }
}

/**
 * Modifica una cuenta existente: código, nombre, tipo, jerarquía o estado.
 *
 * Reglas que garantiza el servidor:
 * - el código sigue siendo único en todo el plan;
 * - una subcuenta siempre comparte el tipo de su cuenta padre (al cambiar el
 *   tipo de una cuenta, éste se propaga a todas sus subcuentas);
 * - no se crea ninguna jerarquía cíclica (una cuenta no puede colgarse de
 *   una de sus propias subcuentas);
 * - no se desactiva una cuenta con subcuentas activas, ni se activa una
 *   cuenta cuyo padre esté inactiva.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Sólo para poder nombrar el código en el error de carrera del índice único.
  let codigoNuevo: string | undefined;

  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);

    if (Number.isNaN(id)) {
      return Response.json({ error: "Identificador de cuenta inválido." }, { status: 400 });
    }

    const cuenta = await prisma.cuenta_contable.findUnique({
      where: { id_cuenta_contable: id },
      select: SELECT_CUENTA,
    });

    if (!cuenta) {
      return Response.json({ error: "Cuenta contable no encontrada." }, { status: 404 });
    }

    const cuerpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      return Response.json(
        { error: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const { errores, valores } = validarCuenta(cuerpo, "edicion");
    codigoNuevo = valores.codigo;
    if (errores.length > 0) return respuestaValidacion(errores);

    // El código no puede repetirse con otra cuenta del plan.
    if (valores.codigo !== undefined) {
      const repetida = await prisma.cuenta_contable.findUnique({
        where: { codigo: valores.codigo },
        select: { id_cuenta_contable: true },
      });
      if (repetida && repetida.id_cuenta_contable !== id) {
        return respuestaCodigoDuplicado(valores.codigo);
      }
    }

    const tipoFinal = valores.tipo ?? cuenta.tipo;
    const tipoCambiado = valores.tipo !== undefined && valores.tipo !== cuenta.tipo;
    const cambiaPadre = valores.idPadre !== undefined;
    const idPadreFinal = cambiaPadre ? (valores.idPadre ?? null) : cuenta.id_cuenta_padre;
    const propioPadre = cambiaPadre && idPadreFinal === id;

    if (propioPadre) {
      errores.push("Una cuenta no puede ser su propia cuenta padre.");
      return respuestaValidacion(errores);
    }

    // La jerarquía completa sólo hace falta para detectar ciclos y propagar el tipo.
    const nodos: NodoJerarquia[] | null =
      cambiaPadre || tipoCambiado
        ? await prisma.cuenta_contable.findMany({ select: SELECT_NODO })
        : null;

    // Cuenta padre final, cargada una sola vez y sólo si hace falta validarla.
    const necesitaPadre =
      idPadreFinal !== null &&
      ((cambiaPadre && idPadreFinal !== id) ||
        tipoCambiado ||
        valores.activo === true);

    const padre = necesitaPadre
      ? await prisma.cuenta_contable.findUnique({
          where: { id_cuenta_contable: idPadreFinal as number },
          select: SELECT_PADRE,
        })
      : null;

    if (necesitaPadre && !padre) {
      errores.push("La cuenta padre indicada no existe.");
    } else if (padre) {
      if (cambiaPadre) {
        if (!padre.activo) {
          errores.push("La cuenta padre está inactiva: actívala antes de mover la cuenta.");
        }
        if (padre.tipo !== tipoFinal) {
          errores.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${padre.tipo}).`);
        }
        if (nodos && descendientesDe(id, nodos).includes(idPadreFinal as number)) {
          errores.push("La cuenta padre no puede ser una subcuenta de la misma cuenta.");
        }
      } else {
        if (tipoCambiado && padre.tipo !== tipoFinal) {
          errores.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${padre.tipo}).`);
        }
        if (valores.activo === true && !padre.activo) {
          errores.push("No se puede activar una cuenta cuya cuenta padre está inactiva.");
        }
      }
    }

    // Estado: no se puede apagar una rama con subcuentas encendidas.
    if (valores.activo === false) {
      const hijaActiva = await prisma.cuenta_contable.findFirst({
        where: { id_cuenta_padre: id, activo: true },
        select: { id_cuenta_contable: true },
      });
      if (hijaActiva) {
        errores.push("No se puede desactivar una cuenta con subcuentas activas: desactívalas primero.");
      }
    }

    if (errores.length > 0) return respuestaValidacion(errores);

    const descendientes = nodos && tipoCambiado ? descendientesDe(id, nodos) : [];

    // Cuenta actualizada y, si cambió el tipo, todas sus subcuentas en una
    // sola transacción para que la jerarquía nunca quede con tipos mezclados.
    const actualizada = await prisma.$transaction(async (transaccion) => {
      const modificada = await transaccion.cuenta_contable.update({
        where: { id_cuenta_contable: id },
        data: {
          ...(valores.codigo !== undefined && { codigo: valores.codigo }),
          ...(valores.nombre !== undefined && { nombre: valores.nombre }),
          ...(valores.tipo !== undefined && { tipo: valores.tipo }),
          ...(cambiaPadre && { id_cuenta_padre: idPadreFinal }),
          ...(valores.activo !== undefined && { activo: valores.activo }),
        },
        select: SELECT_CUENTA,
      });

      if (tipoCambiado && descendientes.length > 0) {
        await transaccion.cuenta_contable.updateMany({
          where: { id_cuenta_contable: { in: descendientes } },
          data: { tipo: tipoFinal },
        });
      }

      return modificada;
    });

    return Response.json(aCuentaApi(actualizada));
  } catch (error) {
    // Otra petición tomó el mismo código entre la comprobación y el update.
    if (codigoDuplicado(error)) {
      return Response.json(
        {
          error: codigoNuevo
            ? `Ya existe una cuenta contable con el código ${codigoNuevo}.`
            : "Ya existe una cuenta contable con ese código.",
        },
        { status: 409 }
      );
    }
    console.error("[api/cuentas/[id]] error al actualizar la cuenta:", error);
    return Response.json(
      { error: "No se pudo actualizar la cuenta contable." },
      { status: 500 }
    );
  }
}
