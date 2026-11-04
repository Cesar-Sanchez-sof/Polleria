/**
 * Personalización de la marca: textos del login y del inicio, y las imágenes (logo y foto del inicio).
 * Este archivo no importa nada del servidor: lo usan las pantallas, las APIs y las pruebas.
 *
 * Todo lo que el usuario puede cambiar vive en `BrandingContent`. `resolveBranding` acepta cualquier
 * valor (lo guardado, lo que llega por la API) y siempre devuelve un contenido completo y seguro:
 * los textos se recortan, los enlaces solo pueden ser rutas internas y lo que falte vuelve al valor
 * por defecto.
 */

export const ASSET_SLOTS = ["logo", "home-hero"] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

export function isAssetSlot(value: unknown): value is AssetSlot {
  return typeof value === "string" && (ASSET_SLOTS as readonly string[]).includes(value);
}

/** Tipos de imagen aceptados y tamaño máximo (cabe en el límite de cuerpo de las funciones serverless). */
export const ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;

/** Imagen que se muestra mientras la base de datos no tenga una subida por el usuario. */
export const ASSET_FALLBACKS: Record<AssetSlot, string> = {
  logo: "/images/Los_Betos_Logo.jpg",
  "home-hero": "/images/home-hero.jpg",
};

export const ASSET_LABELS: Record<AssetSlot, string> = {
  logo: "Logo",
  "home-hero": "Foto del inicio",
};

/** Una novedad del panel «Últimas actualizaciones» del inicio. */
export interface UpdateEntry {
  /** Fecha `AAAA-MM-DD`. */
  date: string;
  title: string;
  description: string;
}

export const MAX_UPDATES = 8;

export interface BrandingContent {
  /** "Los Betos": nombre corto de la marca (título grande del login). */
  brandName: string;
  /** "Pollería Los Betos": nombre completo (textos alternativos y pie de página). */
  fullName: string;
  /** "Pollería & Brasas". */
  tagline: string;
  /** "Tradición, sabor y excelencia gastronómica". */
  slogan: string;
  login: {
    eyebrow: string;
    statusLabel: string;
    securityNote: string;
    title: string;
    subtitle: string;
    restrictedNotice: string;
    rights: string;
  };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    updatesTitle: string;
    updates: UpdateEntry[];
  };
}

export const DEFAULT_BRANDING: BrandingContent = {
  brandName: "Los Betos",
  fullName: "Pollería Los Betos",
  tagline: "Pollería & Brasas",
  slogan: "Tradición, sabor y excelencia gastronómica",
  login: {
    eyebrow: "Punto de Venta & Operaciones",
    statusLabel: "Sistema en Línea",
    securityNote: "Acceso Privado & Seguro",
    title: "Iniciar Sesión",
    subtitle: "Ingresa tus credenciales autorizadas para acceder al sistema.",
    restrictedNotice: "Acceso restringido para el personal autorizado",
    rights: "Todos los derechos reservados",
  },
  home: {
    eyebrow: "ERP integral",
    title: "Pollería",
    subtitle: "Opera el salón, la cocina, las compras y la contabilidad desde un solo lugar.",
    primaryLabel: "Abrir salón",
    primaryHref: "/sales?tab=tables",
    secondaryLabel: "Ir a caja",
    secondaryHref: "/sales?tab=cashier",
    updatesTitle: "Últimas actualizaciones",
    updates: [
      {
        date: "2026-11-03",
        title: "Personalización del sistema",
        description: "El login y el inicio se editan desde Configuración → Personalización.",
      },
      {
        date: "2026-11-03",
        title: "Planilla de remuneraciones",
        description: "Cálculo mensual de boletas con asientos contables y parámetros editables.",
      },
      {
        date: "2026-11-03",
        title: "Contratos laborales",
        description: "Plazo fijo, indeterminado, privado y convenio de prácticas.",
      },
      {
        date: "2026-11-03",
        title: "PLE más completo",
        description: "Los libros 8.1 y 14.1 incluyen el ICBPER y limpian caracteres no permitidos.",
      },
      {
        date: "2026-11-02",
        title: "SIRE · Comprobantes de compras",
        description: "Consulta tus compras en SUNAT sin guardar sus datos en el sistema.",
      },
      {
        date: "2026-11-02",
        title: "Dictado por voz en el asistente",
        description: "Habla en lugar de escribir al consultar al asistente.",
      },
    ],
  },
};

const SHORT = 80;
const MEDIUM = 160;
const LONG = 300;

function text(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : fallback;
}

/** Solo rutas internas ("/sales"): nunca "//otro-sitio", "http://…" ni "javascript:…". */
function internalHref(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const href = value.trim();
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\") || /[\u0000-\u001f\u007f\s]/.test(href)) {
    return fallback;
  }
  return href.slice(0, 200);
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Fecha `AAAA-MM-DD` real (rechaza 2026-13-45); si no es válida devuelve `fallback`. */
function isoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? value.trim() : fallback;
}

/**
 * Novedades: si no llega una lista se usan las de por defecto; si llega (aunque vacía) se respeta.
 * Se descartan las entradas sin título y se conservan las `MAX_UPDATES` primeras.
 */
function updates(raw: unknown, fallback: UpdateEntry[]): UpdateEntry[] {
  if (!Array.isArray(raw)) return fallback;
  const today = new Date().toISOString().slice(0, 10);
  const result: UpdateEntry[] = [];
  for (const item of raw) {
    const entry = record(item);
    const title = text(entry.title, "", SHORT);
    if (!title) continue;
    result.push({
      date: isoDate(entry.date, today),
      title,
      description: text(entry.description, "", LONG),
    });
    if (result.length === MAX_UPDATES) break;
  }
  return result;
}

/** Completa y sanea cualquier contenido de personalización. Nunca lanza. */
export function resolveBranding(raw: unknown): BrandingContent {
  const d = DEFAULT_BRANDING;
  const root = record(raw);
  const login = record(root.login);
  const home = record(root.home);

  return {
    brandName: text(root.brandName, d.brandName, SHORT),
    fullName: text(root.fullName, d.fullName, SHORT),
    tagline: text(root.tagline, d.tagline, SHORT),
    slogan: text(root.slogan, d.slogan, MEDIUM),
    login: {
      eyebrow: text(login.eyebrow, d.login.eyebrow, MEDIUM),
      statusLabel: text(login.statusLabel, d.login.statusLabel, SHORT),
      securityNote: text(login.securityNote, d.login.securityNote, SHORT),
      title: text(login.title, d.login.title, SHORT),
      subtitle: text(login.subtitle, d.login.subtitle, LONG),
      restrictedNotice: text(login.restrictedNotice, d.login.restrictedNotice, MEDIUM),
      rights: text(login.rights, d.login.rights, SHORT),
    },
    home: {
      eyebrow: text(home.eyebrow, d.home.eyebrow, SHORT),
      title: text(home.title, d.home.title, SHORT),
      subtitle: text(home.subtitle, d.home.subtitle, LONG),
      primaryLabel: text(home.primaryLabel, d.home.primaryLabel, SHORT),
      primaryHref: internalHref(home.primaryHref, d.home.primaryHref),
      secondaryLabel: text(home.secondaryLabel, d.home.secondaryLabel, SHORT),
      secondaryHref: internalHref(home.secondaryHref, d.home.secondaryHref),
      updatesTitle: text(home.updatesTitle, d.home.updatesTitle, SHORT),
      updates: updates(home.updates, d.home.updates),
    },
  };
}

/** Dirección pública de una imagen; `version` (marca de tiempo) evita que el navegador muestre una vieja. */
export function assetUrl(slot: AssetSlot, version?: number | null): string {
  return `/api/branding/assets/${slot}${version ? `?v=${version}` : ""}`;
}

/** Firma mínima de archivo (los primeros bytes) para no confiar solo en el tipo que declara el navegador. */
export function detectImageMime(bytes: Uint8Array): (typeof ASSET_MIME_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
