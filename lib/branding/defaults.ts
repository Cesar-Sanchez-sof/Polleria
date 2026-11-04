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

export interface QuickActionContent {
  key: string;
  label: string;
  hint: string;
  href: string;
}

export interface ModuleContent {
  key: string;
  title: string;
  description: string;
  href: string;
}

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
    quickActionsTitle: string;
    quickActionsSubtitle: string;
    modulesTitle: string;
    modulesSubtitle: string;
    quickActions: QuickActionContent[];
    modules: ModuleContent[];
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
    quickActionsTitle: "Operación de hoy",
    quickActionsSubtitle: "Atajos al flujo del restaurante",
    modulesTitle: "Módulos del sistema",
    modulesSubtitle: "Administración comercial, logística y financiera",
    quickActions: [
      { key: "tables", label: "Salón de mesas", hint: "Tomar pedidos en piso", href: "/sales?tab=tables" },
      { key: "kitchen", label: "Cocina KDS", hint: "Comandas en preparación", href: "/sales?tab=kitchen" },
      { key: "cashier", label: "Ventanilla", hint: "Cerrar cuentas", href: "/sales?tab=cashier" },
      { key: "sales", label: "Ventas", hint: "Gestión completa", href: "/sales" },
    ],
    modules: [
      {
        key: "sales",
        title: "Ventas y salón",
        description: "Mesas, para llevar, clientes, cobros y facturación electrónica.",
        href: "/sales?tab=tables",
      },
      {
        key: "purchases",
        title: "Compras e inventario",
        description: "Proveedores, órdenes, recepción, kardex y transformación.",
        href: "/purchases",
      },
      {
        key: "stock",
        title: "Stock e insumos",
        description: "Control de existencias, ajustes y alertas de reorden.",
        href: "/purchases/inventory",
      },
      {
        key: "accounting",
        title: "Contabilidad",
        description: "Asientos, plan de cuentas, diario, mayor y resultados.",
        href: "/accounting/entries",
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

/** Cada elemento se identifica por su `key`; los que no llegan conservan el valor por defecto. */
function byKey<T extends { key: string }>(defaults: T[], raw: unknown, merge: (base: T, entry: Record<string, unknown>) => T): T[] {
  const entries = Array.isArray(raw) ? raw.map(record) : [];
  return defaults.map((base) => {
    const entry = entries.find((candidate) => candidate.key === base.key);
    return entry ? merge(base, entry) : base;
  });
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
      quickActionsTitle: text(home.quickActionsTitle, d.home.quickActionsTitle, SHORT),
      quickActionsSubtitle: text(home.quickActionsSubtitle, d.home.quickActionsSubtitle, MEDIUM),
      modulesTitle: text(home.modulesTitle, d.home.modulesTitle, SHORT),
      modulesSubtitle: text(home.modulesSubtitle, d.home.modulesSubtitle, MEDIUM),
      quickActions: byKey(d.home.quickActions, home.quickActions, (base, entry) => ({
        key: base.key,
        label: text(entry.label, base.label, SHORT),
        hint: text(entry.hint, base.hint, MEDIUM),
        href: internalHref(entry.href, base.href),
      })),
      modules: byKey(d.home.modules, home.modules, (base, entry) => ({
        key: base.key,
        title: text(entry.title, base.title, SHORT),
        description: text(entry.description, base.description, LONG),
        href: internalHref(entry.href, base.href),
      })),
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
