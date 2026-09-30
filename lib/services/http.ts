/**
 * HTTP helpers shared by API services (`*.service.ts`).
 *
 * All services communicate with `app/api/**` JSON endpoints:
 * errors return `{ error, errores? }`, converted here to `ApiError`
 * with main message and detailed validation list.
 */

/** Business error returned by the API, with details for each validation. */
export class ApiError extends Error {
  /** One entry per failed validation (the first is the primary message). */
  readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.errors = errors.length > 0 ? errors : [message];
  }

  // Alias for backward compatibility
  get errores(): string[] {
    return this.errors;
  }
}

/** Backward compatibility alias */
export const ErrorApi = ApiError;

/** Performs fetch request and returns JSON body; throws `ApiError` on failure. */
export async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  if (!response.ok) {
    let message = "Error inesperado al consultar el servicio.";
    let details: string[] = [];
    try {
      const body = (await response.json()) as { error?: string; errores?: string[] };
      if (body?.error) message = body.error;
      if (Array.isArray(body?.errores)) details = body.errores;
    } catch {
      /* response did not contain JSON */
    }
    throw new ApiError(message, details);
  }

  return (await response.json()) as T;
}

/** `GET` request without cache. */
export async function getJson<T>(url: string): Promise<T> {
  return fetchJson<T>(url, { cache: "no-store" });
}

/** `POST` request with JSON body. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** `PATCH` request with JSON body. */
export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Backward compatibility aliases
export const pedir = fetchJson;
export const obtenerJson = getJson;
export const enviarJson = postJson;
export const actualizarJson = patchJson;
