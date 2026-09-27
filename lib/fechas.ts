/**
 * Utilidades de fecha para la API de asientos contables.
 *
 * `fecha_contable` es una columna `@db.Date`: se almacena como fecha pura,
 * por lo que hay que leerla y escribirla en UTC para que el día no se corra
 * según la zona horaria del servidor.
 */

/** Convierte "YYYY-MM-DD" a un `Date` a medianoche UTC. */
export function fechaUTC(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Devuelve "YYYY-MM-DD" de una fecha almacenada como `@db.Date`, sin corrimiento horario. */
export function fechaAISO(fecha: Date): string {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}
