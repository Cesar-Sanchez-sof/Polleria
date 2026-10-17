/**
 * Utilidades para clasificación y filtrado de platos y bebidas.
 * Permite separar los ítems que requieren preparación en cocina de las
 * bebidas que despacha directamente el mozo o la barra.
 */

const BEVERAGE_KEYWORDS = [
  // Gaseosas comerciales
  "inka",
  "inca",
  "coca",
  "fanta",
  "sprite",
  "crush",
  "pepsi",
  "7up",
  "seven up",
  "gaseosa",
  // Bebidas naturales y refrescos peruanos
  "chicha",
  "maracuya",
  "maracuyá",
  "limonada",
  "jugo",
  "refresco",
  "emoliente",
  // Aguas
  "agua",
  "mineral",
  "san luis",
  "san mateo",
  "cielo",
  // Cervezas y licores
  "cerveza",
  "cusqueña",
  "cusquena",
  "pilsen",
  "cristal",
  "corona",
  "stella",
  "heineken",
  "vino",
  "sangria",
  "sangría",
  "pisco",
  "chilcano",
  "trago",
  "coctel",
  "cocktail",
  "ron",
  "vodka",
  "whisky",
  // Calientes e infusiones
  "infusion",
  "infusión",
  "cafe",
  "café",
  "ice tea",
  "té helado",
  "te helado",
  "bebida",
];

// Palabras clave que indican comida y descartan falso positivo de bebida
const FOOD_KEYWORDS = [
  "pollo",
  "mostrito",
  "brasa",
  "papa",
  "tequeño",
  "tequeno",
  "chaufa",
  "ensalada",
  "porción",
  "porcion",
  "guarnic",
  "arroz",
  "alitas",
  "huevo",
];

/**
 * Determina si un producto de la carta corresponde a una bebida.
 */
export function isBeverage(name: string, description?: string | null): boolean {
  if (!name) return false;
  const text = `${name} ${description || ""}`.toLowerCase().trim();

  // Si tiene palabras claras de comida preparada, no es bebida
  const hasFoodKeyword = FOOD_KEYWORDS.some((fw) => text.includes(fw));
  if (hasFoodKeyword) return false;

  return BEVERAGE_KEYWORDS.some((bw) => text.includes(bw));
}

/**
 * Categoriza un plato según su denominación.
 */
export function determineCategory(
  name: string,
  description?: string | null,
): "pollos" | "adicionales" | "bebidas" | "otros" {
  if (isBeverage(name, description)) {
    return "bebidas";
  }

  const text = `${name} ${description || ""}`.toLowerCase().trim();
  if (
    text.includes("papa") ||
    text.includes("tequeño") ||
    text.includes("tequeno") ||
    text.includes("chaufa") ||
    text.includes("ensalada") ||
    text.includes("porción") ||
    text.includes("porcion") ||
    text.includes("guarnic") ||
    text.includes("arroz")
  ) {
    return "adicionales";
  }
  if (text.includes("pollo") || text.includes("mostrito") || text.includes("brasa") || text.includes("alitas")) {
    return "pollos";
  }

  return "otros";
}
