/**
 * Reglas del plan contable compartidas por las rutas de `/api/cuentas`.
 *
 * Sólo lo usan los route handlers (server): validación de campos, respuesta
 * de errores, detección del índice único de `codigo` y cálculo de jerarquía.
 * El catálogo de tipos se mantiene alineado con `lib/services/cuentas.service`.
 */
import { Prisma } from "@prisma/client";

/** Tipos de cuenta admitidos (PCGE 2019), en el orden en que se listan. */
export const TIPOS_VALIDOS = [
  "Activo",
  "Pasivo",
  "Patrimonio",
  "Ingreso",
  "Gasto",
  "Costo",
] as const;

/** Formato admitido para `cuenta_contable.codigo` (`@db.VarChar(10)`). */
export const CODIGO_RE = /^[A-Za-z0-9.-]{1,10}$/;

/** Campos ya validados y normalizados listos para persistirse. */
export interface ValoresCuenta {
  codigo?: string;
  nombre?: string;
  tipo?: string;
  /** `null` = cuenta raíz (sin padre). */
  idPadre?: number | null;
  activo?: boolean;
}

/** Texto recortado del body; cualquier valor que no sea texto se trata como vacío. */
export function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Valida y normaliza los campos de una cuenta según el modo:
 *
 * - `alta`: código, nombre, tipo, jerarquía y estado son obligatorios.
 * - `edicion`: sólo se valida lo presente en el body (campo por campo).
 *
 * Devuelve los errores (si los hay) y los campos válidos.
 */
export function validarCuenta(
  cuerpo: Record<string, unknown>,
  modo: "alta" | "edicion"
): { errores: string[]; valores: ValoresCuenta } {
  const errores: string[] = [];
  const valores: ValoresCuenta = {};
  const esAlta = modo === "alta";

  const codigo = texto(cuerpo.codigo);
  if (esAlta || cuerpo.codigo !== undefined) {
    if (!codigo) {
      errores.push("El código de la cuenta es obligatorio.");
    } else if (!CODIGO_RE.test(codigo)) {
      errores.push(
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion."
      );
    } else {
      valores.codigo = codigo;
    }
  }

  const nombre = texto(cuerpo.nombre);
  if (esAlta || cuerpo.nombre !== undefined) {
    if (!nombre) {
      errores.push("El nombre de la cuenta es obligatorio.");
    } else if (nombre.length > 100) {
      errores.push("El nombre de la cuenta no puede superar los 100 caracteres.");
    } else {
      valores.nombre = nombre;
    }
  }

  if (esAlta || cuerpo.tipo !== undefined) {
    const tipo = texto(cuerpo.tipo);
    if (!(TIPOS_VALIDOS as readonly string[]).includes(tipo)) {
      errores.push(
        `El tipo de cuenta no es válido (valores admitidos: ${TIPOS_VALIDOS.join(", ")}).`
      );
    } else {
      valores.tipo = tipo;
    }
  }

  if (esAlta || cuerpo.idPadre !== undefined) {
    const idPadre = cuerpo.idPadre;
    if (idPadre === undefined || idPadre === null) {
      valores.idPadre = null;
    } else {
      const numero = typeof idPadre === "number" ? idPadre : Number(idPadre);
      if (!Number.isInteger(numero) || numero <= 0) {
        errores.push("La cuenta padre indicada no es válida.");
      } else {
        valores.idPadre = numero;
      }
    }
  }

  if (esAlta || cuerpo.activo !== undefined) {
    const activo = esAlta && cuerpo.activo === undefined ? true : cuerpo.activo;
    if (typeof activo !== "boolean") {
      errores.push("El estado de la cuenta debe ser activo o inactivo.");
    } else {
      valores.activo = activo;
    }
  }

  return { errores, valores };
}

/** `true` cuando el fallo corresponde al índice único de `cuenta_contable.codigo`. */
export function codigoDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Respuesta 400 con el primer error como mensaje y el detalle completo. */
export function respuestaValidacion(errores: string[]): Response {
  return Response.json({ error: errores[0], errores }, { status: 400 });
}

/** Respuesta 409: ya existe otra cuenta con ese código. */
export function respuestaCodigoDuplicado(codigo: string): Response {
  return Response.json(
    { error: `Ya existe una cuenta contable con el código ${codigo}.` },
    { status: 409 }
  );
}

/** Campos que devuelve siempre la API de cuentas. */
export const SELECT_CUENTA = {
  id_cuenta_contable: true,
  codigo: true,
  nombre: true,
  tipo: true,
  id_cuenta_padre: true,
  activo: true,
  _count: { select: { detalles_asiento: true } },
} as const;

/** Fila de `cuenta_contable` tal y como la devuelven los `select` de las rutas. */
export interface CuentaFila {
  id_cuenta_contable: number;
  codigo: string;
  nombre: string;
  tipo: string;
  id_cuenta_padre: number | null;
  activo: boolean;
  _count?: { detalles_asiento: number };
}

/** Forma pública de una cuenta en las respuestas de la API. */
export interface CuentaApi {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  idPadre: number | null;
  activo: boolean;
  usos: number;
}

/** Convierte una fila de la base en la respuesta pública. */
export function aCuentaApi(cuenta: CuentaFila): CuentaApi {
  return {
    id: cuenta.id_cuenta_contable,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    idPadre: cuenta.id_cuenta_padre,
    activo: cuenta.activo,
    usos: cuenta._count?.detalles_asiento ?? 0,
  };
}

/** Relación mínima necesaria para recorrer la jerarquía de cuentas. */
export interface NodoJerarquia {
  id_cuenta_contable: number;
  id_cuenta_padre: number | null;
}

/**
 * Ids de todas las subcuentas (hijas, nietas, …) de la cuenta indicada.
 * Se calcula sobre el listado completo para no hacer consultas recursivas.
 */
export function descendientesDe(id: number, nodos: NodoJerarquia[]): number[] {
  const hijosPorPadre = new Map<number, number[]>();
  for (const nodo of nodos) {
    if (nodo.id_cuenta_padre === null) continue;
    const lista = hijosPorPadre.get(nodo.id_cuenta_padre) ?? [];
    lista.push(nodo.id_cuenta_contable);
    hijosPorPadre.set(nodo.id_cuenta_padre, lista);
  }

  const descendientes: number[] = [];
  const pendientes = [...(hijosPorPadre.get(id) ?? [])];
  while (pendientes.length > 0) {
    const actual = pendientes.shift() as number;
    descendientes.push(actual);
    pendientes.push(...(hijosPorPadre.get(actual) ?? []));
  }
  return descendientes;
}
