/** Utilidades de cliente para las pantallas de Recursos Humanos. */

export const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

/** fetch + JSON que lanza `Error` con el mensaje de la API si la respuesta no es 2xx. */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Ocurrió un error inesperado");
  return body as T;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-04" → "04 nov 2026". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Minutos → "7 h 30 min". */
export function fmtMinutes(min: number): string {
  if (!min) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" });
}

/** Origen de una marcación de asistencia (mismo catálogo que el servidor). */
export const MARK_SOURCE: Record<string, { label: string; short: string; tone: "blue" | "emerald" | "amber" | "indigo" | "neutral" }> = {
  InicioSesion: { label: "Inicio de sesión", short: "Login", tone: "blue" },
  CierreSesion: { label: "Cierre de sesión", short: "Logout", tone: "blue" },
  Autoservicio: { label: "Autoservicio (Mi horario)", short: "Autoserv.", tone: "emerald" },
  Manual: { label: "Registrada por RR. HH.", short: "RR. HH.", tone: "amber" },
  Correccion: { label: "Corrección de RR. HH.", short: "Corrección", tone: "indigo" },
};
