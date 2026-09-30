/**
 * Helpers HTTP compartidos por los servicios de la API (`*.service.ts`).
 *
 * Todos los servicios hablan con rutas `app/api/**` que responden JSON:
 * en error devuelven `{ error, errores? }`, que aquí se convierte en un
 * `ErrorApi` con el mensaje principal y el detalle de cada validación.
 */

/** Error de negocio devuelto por la API, con el detalle de cada validación. */
export class ErrorApi extends Error {
  /** Una entrada por cada validación fallida (la primera es la principal). */
  readonly errores: string[];

  constructor(mensaje: string, errores: string[] = []) {
    super(mensaje);
    this.name = "ErrorApi";
    this.errores = errores.length > 0 ? errores : [mensaje];
  }
}

/** Ejecuta la petición y devuelve el cuerpo JSON; en error lanza `ErrorApi`. */
export async function pedir<T>(url: string, opciones: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  if (!respuesta.ok) {
    let mensaje = "Error inesperado al consultar el servicio.";
    let detalle: string[] = [];
    try {
      const cuerpo = (await respuesta.json()) as { error?: string; errores?: string[] };
      if (cuerpo?.error) mensaje = cuerpo.error;
      if (Array.isArray(cuerpo?.errores)) detalle = cuerpo.errores;
    } catch {
      /* la respuesta no traía cuerpo JSON */
    }
    throw new ErrorApi(mensaje, detalle);
  }

  return (await respuesta.json()) as T;
}

/** `GET` sin caché. */
export async function obtenerJson<T>(url: string): Promise<T> {
  return pedir<T>(url, { cache: "no-store" });
}

/** `POST` con cuerpo JSON. */
export async function enviarJson<T>(url: string, cuerpo: unknown): Promise<T> {
  return pedir<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

/** `PATCH` con cuerpo JSON. */
export async function actualizarJson<T>(url: string, cuerpo: unknown): Promise<T> {
  return pedir<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}
