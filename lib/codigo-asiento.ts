/**
 * Numeración de los asientos contables registrados a mano.
 *
 * Los asientos manuales se numeran con el mismo formato misceláneo que usa el
 * seed (`MISC/AAAA/MM/NNNN`), de modo que cada mes arranca en 0001 y el valor
 * sigue siendo único en `asiento_contable.codigo` (columna `@db.VarChar(20)`).
 */
import { prisma } from "@/lib/prisma";

/** Longitud máxima soportada por `asiento_contable.codigo`. */
const LARGO_MAXIMO = 20;

/** Prefijo `MISC/AAAA/MM/` propio de la fecha contable indicada. */
function prefijoDe(fecha: Date): string {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `MISC/${anio}/${mes}/`;
}

/**
 * Devuelve el primer código `MISC/AAAA/MM/NNNN` libre para la fecha dada.
 *
 * Parte del máximo ya usado en ese mes y va subiendo hasta encontrar un número
 * disponible; si dos peticiones concurrentes obtienen el mismo candidato, el
 * índice único de la base rechaza la segunda y el llamante puede reintentar.
 */
export async function generarCodigoAsiento(fecha: Date): Promise<string> {
  const base = prefijoDe(fecha);

  const existentes = await prisma.asiento_contable.findMany({
    where: { codigo: { startsWith: base } },
    select: { codigo: true },
  });

  const maximo = existentes.reduce((mayor, asiento) => {
    const numero = Number.parseInt(asiento.codigo.slice(base.length), 10);
    return Number.isNaN(numero) ? mayor : Math.max(mayor, numero);
  }, 0);

  for (let numero = maximo + 1; numero <= maximo + 50; numero++) {
    const codigo = `${base}${String(numero).padStart(4, "0")}`;
    if (codigo.length > LARGO_MAXIMO) break;

    const ocupado = await prisma.asiento_contable.findUnique({
      where: { codigo },
      select: { id_asiento_contable: true },
    });
    if (!ocupado) return codigo;
  }

  throw new Error("No se pudo generar un número de asiento disponible.");
}
