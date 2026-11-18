/**
 * Utilidades para resolución y formateo de URLs de imágenes en Dashboards.
 */

/**
 * Resuelve y normaliza URLs de imágenes para widgets de dashboard.
 * 
 * Si la URL apunta a un bucket de S3 remoto (Neon Object Storage o AWS S3 privado)
 * que rechaza peticiones anónimas directas del navegador, la redirige a través
 * del endpoint local `/api/storage/...` que sirve el archivo de forma transparente
 * y con alta velocidad (usando la copia física local o el cliente S3 con credenciales).
 */
export function resolveDashboardImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // 1. Data URLs o blobs en memoria
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // 2. Rutas relativas locales de /api/storage/
  if (trimmed.startsWith("/api/storage/")) {
    return trimmed;
  }

  // 3. Rutas de /storage/comprobantes/ -> redirigir a /api/storage/
  if (trimmed.startsWith("/storage/comprobantes/")) {
    const key = trimmed.replace("/storage/comprobantes/", "");
    return `/api/storage/${key}`;
  }

  // 4. Otras rutas relativas del proyecto (/images/..., /Los_Betos_Logo.jpg, etc.)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  // 5. URLs remotas de Neon Object Storage o AWS S3
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    const isS3Host =
      host.includes("storage.") ||
      host.includes(".s3.") ||
      host.includes(".s3-") ||
      host.includes("amazonaws.com") ||
      host.includes("neon.tech");

    if (isS3Host) {
      const pathname = parsed.pathname;
      const comprobantesIdx = pathname.indexOf("/comprobantes/");
      if (comprobantesIdx !== -1) {
        const key = pathname.substring(comprobantesIdx + "/comprobantes/".length);
        return `/api/storage/${key}`;
      }

      const dashboardsIdx = pathname.indexOf("/dashboards/");
      if (dashboardsIdx !== -1) {
        const key = pathname.substring(dashboardsIdx + 1);
        return `/api/storage/${key}`;
      }
    }
  } catch {
    // Si no es parseable como URL absoluta, devolver tal cual
  }

  return trimmed;
}
